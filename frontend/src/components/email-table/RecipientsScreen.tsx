import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { HotTable, HotColumn } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import type { CellValue } from 'handsontable/common';
import { DeleteConfirmationModal } from '../modals';
import { errorMessage } from '../shared/errorMessage';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

registerAllModules();

interface EmailTableRow {
  companyId: string;
  company: string;
  email1: string;
  email2: string;
  email3: string;
  status: string;
  /** Pipeline draft state; not shown as a grid column. */
  draftState: 'none' | 'running' | 'ready' | 'approved' | 'failed' | 'legacy';
}

/** Rows without a usable draft can be removed from the Recipients table. */
function isUndrafted(row: EmailTableRow): boolean {
  return row.draftState !== 'ready' && row.draftState !== 'approved';
}

const listEmailTableRowsQuery = makeFunctionReference<
  'query',
  Record<string, never>,
  EmailTableRow[]
>('emails:listEmailTableRows');

const setEmailRowMutation = makeFunctionReference<
  'mutation',
  { companyId: string; email1?: string; email2?: string; email3?: string },
  null
>('emails:setEmailRow');

const deleteCompaniesMutation = makeFunctionReference<
  'mutation',
  { externalIds: string[] },
  null
>('companies:deleteCompanies');

const columns = [
  'Company',
  'Email1',
  'Email2',
  'Email3',
  'Status',
  'Action',
] as const;
const actionColumnIndex = 5;
const deliveryFilterOptions = [
  { value: 'all', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'not-sent', label: 'Not sent' },
  { value: 'not-drafted', label: 'Not drafted' },
] as const;

type DeliveryFilter = (typeof deliveryFilterOptions)[number]['value'];

/** Editable column index → the company email field it writes (others read-only). */
const editableField: Record<number, 'email1' | 'email2' | 'email3'> = {
  1: 'email1',
  2: 'email2',
  3: 'email3',
};

/** Recipients spreadsheet (Handsontable); loaded lazily by `EmailTableScreen`. */
export function RecipientsScreen() {
  const rows = useQuery(listEmailTableRowsQuery, {});
  const setEmailRow = useMutation(setEmailRowMutation);
  const deleteCompanies = useMutation(deleteCompaniesMutation);

  const [grid, setGrid] = useState<CellValue[][]>([]);
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all');
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const companyIdsRef = useRef<string[]>([]);
  const deletableRef = useRef<boolean[]>([]);
  const companyKeyRef = useRef('');
  const filteredRows = useMemo(() => {
    const loadedRows = rows ?? [];
    if (deliveryFilter === 'sent') {
      return loadedRows.filter((row) => row.status === 'Sent');
    }
    if (deliveryFilter === 'failed') {
      return loadedRows.filter((row) => row.status === 'Failed');
    }
    if (deliveryFilter === 'not-sent') {
      return loadedRows.filter(
        (row) =>
          row.status !== 'Sent' && row.status !== 'Failed' && !isUndrafted(row),
      );
    }
    if (deliveryFilter === 'not-drafted') {
      return loadedRows.filter(isUndrafted);
    }
    return loadedRows;
  }, [rows, deliveryFilter]);
  const filteredCompanyIds = useMemo(
    () => filteredRows.map((row) => row.companyId),
    [filteredRows],
  );

  // Re-seed the grid only when the *set of companies* changes, so persisting an
  // edit (which updates the query) doesn't clobber the cell being typed in.
  useEffect(() => {
    if (rows === undefined) return;
    const key = `${deliveryFilter}:${filteredRows.map((r) => r.companyId).join('|')}`;
    if (key === companyKeyRef.current) return;
    companyKeyRef.current = key;
    companyIdsRef.current = filteredRows.map((r) => r.companyId);
    deletableRef.current = filteredRows.map(isUndrafted);
    setGrid(
      filteredRows.map((r) => [
        r.company,
        r.email1,
        r.email2,
        r.email3,
        r.status,
        isUndrafted(r) ? 'Delete' : '',
      ]),
    );
  }, [rows, filteredRows, deliveryFilter]);

  const companyCount = filteredRows.length;
  const deleteFilteredRows = () => {
    if (filteredCompanyIds.length === 0) return;
    setPendingDeleteIds(filteredCompanyIds);
  };
  const removeCompanies = async (externalIds: string[]) => {
    setDeleteError(null);
    try {
      await deleteCompanies({ externalIds });
    } catch (error) {
      setDeleteError(errorMessage(error, 'Delete failed.'));
    }
  };
  const confirmDeleteRows = async () => {
    if (pendingDeleteIds === null) return;
    const externalIds = pendingDeleteIds;
    setPendingDeleteIds(null);
    await removeCompanies(externalIds);
  };

  return (
    <section className="emailTableScreen">
      <div className="emailTableHeader">
        <h1 className="emailTableTitle">Recipients</h1>
        <p className="emailTableSubtitle">
          Add up to three recipient emails per company. Edits save
          automatically.
        </p>
      </div>
      {deleteError !== null ? (
        <p className="emailTableError" role="alert">
          {deleteError}
        </p>
      ) : null}
      <div className="emailTableCanvas">
        <section className="emailTableCard">
          <div className="emailTableToolbar">
            <div className="emailTableHeaderControls">
              <span className="emailTableCount">
                {companyCount.toLocaleString()} companies
              </span>
              <div
                className="emailTableFilter"
                aria-label="Filter by sent status"
              >
                {deliveryFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`emailTableFilterButton ${
                      deliveryFilter === option.value
                        ? 'emailTableFilterButtonActive'
                        : ''
                    }`}
                    type="button"
                    aria-pressed={deliveryFilter === option.value}
                    onClick={() => setDeliveryFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                className="emailTableDeleteFiltered"
                type="button"
                disabled={filteredCompanyIds.length === 0}
                onClick={deleteFilteredRows}
              >
                Delete filtered
              </button>
            </div>
          </div>
          <div className="emailSpreadsheetShell">
            <HotTable
              id="email-hot-table"
              data={grid}
              colHeaders={[...columns]}
              rowHeaders
              width="100%"
              height="100%"
              stretchH="all"
              className="emailHotTable ht-theme-main"
              licenseKey="non-commercial-and-evaluation"
              navigableHeaders
              manualColumnResize
              colWidths={[220, 220, 220, 220, 120, 90]}
              rowHeights={32}
              cells={(row, col) => {
                if (col === actionColumnIndex && deletableRef.current[row]) {
                  return {
                    readOnly: true,
                    className: 'emailTableActionCell',
                  };
                }
                if (col === actionColumnIndex) {
                  return { readOnly: true };
                }
                return {};
              }}
              afterOnCellMouseDown={(_event, coords) => {
                if (coords.col !== actionColumnIndex || coords.row < 0) return;
                if (!deletableRef.current[coords.row]) return;
                const companyId = companyIdsRef.current[coords.row];
                if (companyId === undefined) return;
                void removeCompanies([companyId]);
              }}
              afterChange={(changes, source) => {
                if (changes === null || source === 'loadData') return;
                for (const [row, col, , next] of changes) {
                  const companyId = companyIdsRef.current[row];
                  const field = editableField[col as number];
                  if (companyId === undefined || field === undefined) continue;
                  const patch: {
                    companyId: string;
                    email1?: string;
                    email2?: string;
                    email3?: string;
                  } = { companyId };
                  patch[field] = String(next ?? '');
                  void setEmailRow(patch);
                }
              }}
            >
              <HotColumn title="Company" data={0} width={220} readOnly />
              <HotColumn title="Email1" data={1} width={220} type="text" />
              <HotColumn title="Email2" data={2} width={220} type="text" />
              <HotColumn title="Email3" data={3} width={220} type="text" />
              <HotColumn title="Status" data={4} width={120} readOnly />
              <HotColumn title="Action" data={5} width={90} readOnly />
            </HotTable>
          </div>
        </section>
      </div>
      {pendingDeleteIds !== null ? (
        <DeleteConfirmationModal
          count={pendingDeleteIds.length}
          onCancel={() => setPendingDeleteIds(null)}
          onConfirm={() => {
            void confirmDeleteRows();
          }}
        />
      ) : null}
    </section>
  );
}

export default RecipientsScreen;
