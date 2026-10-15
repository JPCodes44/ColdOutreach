import { lazy, Suspense } from 'react';

// Handsontable is large, so the Recipients grid is split into its own chunk
// and only downloaded when this screen is opened.
const RecipientsScreen = lazy(() => import('./RecipientsScreen'));

/** Recipients page: shows a placeholder while the spreadsheet loads. */
export function EmailTableScreen() {
  return (
    <Suspense
      fallback={
        <p className="emailTableLoading" role="status">
          Loading recipients…
        </p>
      }
    >
      <RecipientsScreen />
    </Suspense>
  );
}
