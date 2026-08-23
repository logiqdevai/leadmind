import { useMemo } from "react";
import type { Selection } from "@heroui/react";
import { Button, Checkbox, ListBox, Select, Table } from "@heroui/react";
import { PageSizeSelect } from "@/components/ui/page-size-select";
import { Trash2 } from "lucide-react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { TablePagination } from "@/components/ui/table-pagination";
import { isTableNavInteractiveCell, tableNavInteractiveCellClassName, tableNavRowClassName } from "@/components/ui/table-row-link";
import type { Contact } from "@/features/contacts/interfaces/contact.interface";
import { LeadStatus } from "@/features/contacts/interfaces/contact.interface";
import { STATUS_OPTIONS } from "@/features/contacts/constants/contacts.constants";
import { useUpdateContactStatus } from "@/features/contacts/hooks/use-contacts";
import { normalizeUrl } from "@/lib/profile";
import {
    ContactTableDetailLink,
    ContactTableNameCell,
    ContactTableQuickViewButton,
} from "@/pages/dashboard/components/contact-stack-viewer";
import { ContactAlsoFoundByHint } from "@/pages/dashboard/components/contact-also-found-by-hint";
import { contactTableColumnClass } from "@/pages/dashboard/components/contact-table-column-classes";
import { cn } from "@/lib/utils";

const columnHelper = createColumnHelper<Contact>();

interface ListMembersTableProps {
    contacts: Contact[];
    isLoading: boolean;
    isFetching: boolean;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    pageSizeValue: string;
    onPageSizeChange: (value: string) => void;
    onContactOpen?: (contactUuid: string) => void;
    selectedKeys: Set<string>;
    onSelectionChange: (keys: Set<string>) => void;
    onDeleteContact?: (contactUuid: string) => void;
    deletePending?: boolean;
}

export function ListMembersTable({
    contacts,
    isLoading,
    isFetching,
    page,
    pageSize,
    total,
    totalPages,
    onPageChange,
    pageSizeValue,
    onPageSizeChange,
    onContactOpen,
    selectedKeys,
    onSelectionChange,
    onDeleteContact,
    deletePending = false,
}: ListMembersTableProps) {
    const updateStatus = useUpdateContactStatus();

    const columns = useMemo(
        () => [
            columnHelper.accessor((row) => row.name, {
                id: "name",
                header: "Name",
                cell: (info) => {
                    const contact = info.row.original;
                    return (
                        <ContactTableNameCell
                            contactUuid={contact.uuid}
                            name={info.getValue()}
                            onOpen={onContactOpen}
                        />
                    );
                },
            }),
            columnHelper.accessor((row) => row.company, {
                id: "company",
                header: "Company",
                cell: (info) => {
                    const company = info.getValue();
                    if (!company) return "—";
                    return (
                        <span title={company} className="block w-full min-w-0 truncate">
                            {company}
                        </span>
                    );
                },
            }),
            columnHelper.accessor((row) => row.email, {
                id: "email",
                header: "Email",
                cell: (info) => {
                    const email = info.getValue();
                    if (!email) return "—";
                    return (
                        <span title={email} className="block w-full min-w-0 truncate">
                            {email}
                        </span>
                    );
                },
            }),
            columnHelper.accessor((row) => row.website, {
                id: "website",
                header: "Website",
                cell: (info) => {
                    const website = info.getValue()?.trim();
                    if (!website) return "—";
                    const href = normalizeUrl(website);
                    return (
                        <div
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="min-w-0"
                        >
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={website}
                                className="text-accent hover:underline truncate block w-full min-w-0"
                            >
                                {website}
                            </a>
                        </div>
                    );
                },
            }),
            columnHelper.accessor("status", {
                id: "status",
                header: "CRM status",
                cell: (info) => {
                    const contact = info.row.original;
                    return (
                        <div onClick={(e) => e.stopPropagation()} className="min-w-0">
                            <Select
                                aria-label="CRM status"
                                value={contact.status}
                                onChange={(v) =>
                                    updateStatus.mutate({
                                        uuid: contact.uuid,
                                        status: v as LeadStatus,
                                    })
                                }
                            >
                                <Select.Trigger className="w-full min-w-0 max-w-36">
                                    <Select.Value />
                                    <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                    <ListBox>
                                        {STATUS_OPTIONS.map((opt) => (
                                            <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                                {opt.label}
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                        </div>
                    );
                },
            }),
            columnHelper.display({
                id: "filters",
                header: "Filters",
                cell: (info) => {
                    const hint = <ContactAlsoFoundByHint contact={info.row.original} />;
                    return hint ?? <span className="text-muted">—</span>;
                },
            }),
            columnHelper.display({
                id: "actions",
                header: "",
                cell: (info) => {
                    const contact = info.row.original;

                    return (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex justify-end items-center gap-1"
                        >
                            <ContactTableQuickViewButton
                                contactUuid={contact.uuid}
                                contactName={contact.name}
                                onOpen={onContactOpen}
                            />
                            <ContactTableDetailLink contactUuid={contact.uuid} contactName={contact.name} />
                            {onDeleteContact ? (
                                <Button
                                    size="sm"
                                    variant="tertiary"
                                    className="text-danger"
                                    isDisabled={deletePending}
                                    onPress={() => onDeleteContact(contact.uuid)}
                                    aria-label="Delete contact"
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            ) : null}
                        </div>
                    );
                },
            }),
        ],
        [deletePending, onContactOpen, onDeleteContact, updateStatus],
    );

    const table = useReactTable({
        columns,
        data: contacts,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.uuid,
        manualPagination: true,
        pageCount: totalPages,
    });

    const handleSelectionChange = (keys: Selection) => {
        if (keys === "all") {
            onSelectionChange(new Set(contacts.map((c) => c.uuid)));
        } else {
            onSelectionChange(new Set(Array.from(keys, String)));
        }
    };

    return (
        <div className="bg-surface rounded-xl overflow-hidden min-w-0 w-full">
            <Table>
                <Table.ScrollContainer className="w-full max-w-full overflow-x-hidden">
                    <Table.Content
                        aria-label="List members"
                        className="w-full table-fixed"
                        selectionMode="multiple"
                        selectionBehavior="toggle"
                        selectedKeys={selectedKeys}
                        onSelectionChange={handleSelectionChange}
                    >
                        <Table.Header>
                            <Table.Column className="pr-0 w-10">
                                <Checkbox aria-label="Select all" slot="selection">
                                    <Checkbox.Control>
                                        <Checkbox.Indicator />
                                    </Checkbox.Control>
                                </Checkbox>
                            </Table.Column>
                            {table.getHeaderGroups()[0]!.headers.map((header) => (
                                <Table.Column
                                    key={header.id}
                                    id={header.id}
                                    isRowHeader={header.id === "name"}
                                    className={contactTableColumnClass(header.id)}
                                >
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                </Table.Column>
                            ))}
                        </Table.Header>
                        <Table.Body
                            renderEmptyState={() =>
                                isLoading ? null : (
                                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted">
                                        <p className="text-sm">No contacts in this list yet.</p>
                                        <p className="text-xs">
                                            Use the filters below to find and add contacts.
                                        </p>
                                    </div>
                                )
                            }
                        >
                            {isLoading
                                ? Array.from({ length: 5 }).map((_, i) => (
                                      <Table.Row key={`sk-${i}`} id={`sk-${i}`}>
                                          <Table.Cell className="pr-0">
                                              <div className="h-4 w-4 rounded bg-surface-secondary animate-pulse" />
                                          </Table.Cell>
                                          {columns.map((c) => (
                                              <Table.Cell key={c.id}>
                                                  <div className="h-4 w-3/4 rounded bg-surface-secondary animate-pulse" />
                                              </Table.Cell>
                                          ))}
                                      </Table.Row>
                                  ))
                                : table.getRowModel().rows.map((row) => (
                                      <Table.Row key={row.id} id={row.id} className={tableNavRowClassName}>
                                          <Table.Cell className={`pr-0 ${tableNavInteractiveCellClassName}`}>
                                              <Checkbox
                                                  aria-label={`Select ${row.original.name ?? "contact"}`}
                                                  slot="selection"
                                              >
                                                  <Checkbox.Control>
                                                      <Checkbox.Indicator />
                                                  </Checkbox.Control>
                                              </Checkbox>
                                          </Table.Cell>
                                          {row.getVisibleCells().map((cell) => {
                                              const content = flexRender(
                                                  cell.column.columnDef.cell,
                                                  cell.getContext(),
                                              );
                                              const isInteractive = isTableNavInteractiveCell(cell.column.id, [
                                                  "website",
                                                  "status",
                                                  "actions",
                                              ]);

                                              return (
                                                  <Table.Cell
                                                      key={cell.id}
                                                      className={cn(
                                                          contactTableColumnClass(cell.column.id),
                                                          isInteractive
                                                              ? tableNavInteractiveCellClassName
                                                              : undefined,
                                                      )}
                                                  >
                                                      {content}
                                                  </Table.Cell>
                                              );
                                          })}
                                      </Table.Row>
                                  ))}
                        </Table.Body>
                    </Table.Content>
                </Table.ScrollContainer>
                <Table.Footer>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <PageSizeSelect value={pageSizeValue} onChange={onPageSizeChange} />
                        <TablePagination
                            page={page}
                            totalPages={totalPages}
                            total={total}
                            pageSize={pageSize}
                            onPageChange={onPageChange}
                            isFetching={isFetching}
                            isLoading={isLoading}
                            label="contacts"
                        />
                    </div>
                </Table.Footer>
            </Table>
        </div>
    );
}
