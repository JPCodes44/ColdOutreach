'use node';

import { lookup } from 'node:dns/promises';
import { v } from 'convex/values';
import OpenAI from 'openai';
import { internal } from './_generated/api';
import { internalAction } from './_generated/server';
import { computeCostUsd } from './pricing';
import { PipelineError } from './outreach/modelOutput';
import { runOutreachPipeline, type JsonCompletion } from './outreach/pipeline';
import {
  RetrievalError,
  collectWebsiteEvidence,
} from './outreach/websiteEvidence';
import { redactSecrets } from './outreach/smtpOutcome';
import { firecrawlRenderer } from './outreach/pageRenderer';

const DEFAULT_MODEL = 'gpt-4o-mini';

function configuredSecrets(): (string | undefined)[] {
  return [
    process.env.OPENAI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_PAID,
    process.env.GMAIL_APP_PASSWORD,
    process.env.FIRECRAWL_API_KEY,
  ];
}

/** Map any failure to a message safe to store and show (no secrets/stacks). */
function safeFailure(error: unknown): string {
  if (error instanceof PipelineError || error instanceof RetrievalError) {
    return redactSecrets(error.message, configuredSecrets());
  }
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 'network';
    if (error.status === 401)
      return 'The model provider rejected the configured API key.';
    if (error.status === 429)
      return 'The model provider rate limit or quota was reached. Try again later.';
    return `The model provider returned an error (${status}). Try again.`;
  }
  return 'Generation failed unexpectedly. Try again.';
}

/** Execute one pipeline run in the background. Never sends email. */
export const execute = internalAction({
  args: { runId: v.id('pipelineRuns') },
  handler: async (ctx, { runId }) => {
    const input = await ctx.runQuery(internal.outreachRuns.loadRunInput, {
      runId,
    });
    if (input === null) return;

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey === undefined || apiKey.trim() === '') {
        throw new PipelineError(
          'OPENAI_API_KEY is not configured in the Convex environment.',
        );
      }
      const model = process.env.OPENAI_OUTREACH_MODEL?.trim() || DEFAULT_MODEL;
      const openai = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 1 });

      const result = await runOutreachPipeline(
        input.company,
        input.settings,
        {
          collectEvidence: (domain) =>
            collectWebsiteEvidence(domain, {
              fetch: (url, init) => fetch(url, init),
              renderPage: firecrawlRenderer(
                process.env.FIRECRAWL_API_KEY,
                (url, init) => fetch(url, init),
              ),
              resolveHost: async (hostname) =>
                (await lookup(hostname, { all: true, verbatim: true })).map(
                  (entry) => entry.address,
                ),
            }),
          completeJson: async (
            prompt,
            schemaName,
            schema,
          ): Promise<JsonCompletion> => {
            const response = await openai.chat.completions.create({
              model,
              messages: [
                { role: 'system', content: prompt.system },
                { role: 'user', content: prompt.user },
              ],
              response_format: {
                type: 'json_schema',
                json_schema: { name: schemaName, strict: true, schema },
              },
            });
            return {
              text: response.choices[0]?.message.content ?? null,
              promptTokens: response.usage?.prompt_tokens ?? 0,
              completionTokens: response.usage?.completion_tokens ?? 0,
              model,
            };
          },
          onStage: (stage) =>
            ctx.runMutation(internal.outreachRuns.setRunStage, {
              runId,
              stage,
            }),
          onUsage: async (usage) => {
            try {
              await ctx.runMutation(internal.usageDb.recordUsage, {
                provider: 'openai',
                costUsd: computeCostUsd(
                  usage.model,
                  usage.promptTokens,
                  usage.completionTokens,
                ),
              });
            } catch (trackError) {
              console.error(
                'Usage tracking failed',
                trackError instanceof Error ? trackError.name : '',
              );
            }
          },
        },
        { websiteReviewEnabled: input.websiteReviewEnabled },
      );

      await ctx.runMutation(internal.outreachRuns.completeRun, {
        runId,
        evidence: {
          sources: result.evidence.sources,
          facts: result.evidence.facts,
          skipped: result.evidence.skipped,
          excerpts: result.evidence.excerpts,
          ...(result.evidence.researchContext === undefined
            ? {}
            : { researchContext: result.evidence.researchContext }),
        },
        analysis: result.analysis,
        content: result.content,
        model,
      });
    } catch (error) {
      const message = safeFailure(error);
      console.error(`Outreach run ${runId} failed: ${message}`);
      await ctx.runMutation(internal.outreachRuns.failRun, {
        runId,
        error: message,
      });
    }
  },
});
