import type { ClaimReviewProps } from './types';

/**
 * Approval gate: hard blockers must be fixed; each claim not found in the
 * website evidence must be explicitly confirmed (or edited out).
 */
export function ClaimReview({
  claims,
  blockers,
  acknowledged,
  onAcknowledge,
}: ClaimReviewProps) {
  if (claims.length === 0 && blockers.length === 0) return null;
  return (
    <div className="reviewClaims">
      {blockers.map((blocker) => (
        <p key={blocker} className="reviewBanner reviewBanner-error">
          {blocker}
        </p>
      ))}
      {claims.length > 0 ? (
        <fieldset className="reviewBanner reviewBanner-warning reviewClaimList">
          <legend className="reviewClaimLegend">
            Not supported by the website evidence. Edit these out, or confirm
            each is accurate before approving:
          </legend>
          {claims.map((claim) => (
            <label key={claim} className="reviewClaim">
              <input
                type="checkbox"
                checked={acknowledged.includes(claim)}
                onChange={(event) => onAcknowledge(claim, event.target.checked)}
              />
              <span>
                <q>{claim}</q> is accurate
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
