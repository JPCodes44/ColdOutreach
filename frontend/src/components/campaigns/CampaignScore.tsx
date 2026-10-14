import type { CampaignScoreProps } from './types';

/** Discovery confidence as a small bar plus number. */
export function CampaignScore({ score }: CampaignScoreProps) {
  // Snap to the nearest 5% so the fill width maps to a fixed CSS class.
  const fillWidth = Math.min(100, Math.max(0, Math.round(score / 5) * 5));
  return (
    <div className="campaignScore">
      <span className="campaignScoreTrack">
        <span className={`campaignScoreFill campaignScoreFill-${fillWidth}`} />
      </span>
      <span
        className={`campaignCellText ${score >= 80 ? 'campaignScoreGood' : 'campaignScoreLow'}`}
      >
        {score}
      </span>
    </div>
  );
}
