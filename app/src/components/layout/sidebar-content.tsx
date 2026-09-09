import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Disclosure } from "@heroui/react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvidedDragHandleProps,
  type DraggableProvidedDraggableProps,
  type DropResult,
} from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Globe,
  Filter,
  IdCard,
  Megaphone,
  Layers,
  ShieldCheck,
  ChevronDown,
  Plug,
  Bell,
  ClipboardList,
  List,
  Settings,
  BarChart2,
  Activity,
  Gauge,
  Mail,
  Shield,
  FileText,
  Building2,
  User,
  History,
  Trophy,
  ListTodo,
  Wrench,
  Workflow,
  Star,
  GripVertical,
} from "lucide-react";
import { Routes } from "@/routes/routes";
import { usePermission } from "@/hooks/use-permission";
import {
  useAddSidebarFavorite,
  useRemoveSidebarFavorite,
  useReorderSidebarFavorites,
  useSidebarFavorites,
} from "@/features/sidebar-favorites/hooks/use-sidebar-favorites";

interface SidebarContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

type NavItemConfig = {
  label: string;
  icon: React.ElementType;
  href: string;
  end: boolean;
};

type NavGroup = {
  label?: string;
  items: NavItemConfig[];
};

const navGroups: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: Routes.dashboard.root, end: true },
    ],
  },
  {
    label: "CRM",
    items: [
      { label: "Contacts", icon: Users, href: Routes.dashboard.contacts, end: false },
      { label: "Lists", icon: List, href: Routes.dashboard.lists, end: false },
      { label: "Reminders", icon: Bell, href: Routes.dashboard.reminders, end: false },
      { label: "Goals", icon: Trophy, href: Routes.dashboard.goals, end: false },
      { label: "Forms", icon: ClipboardList, href: Routes.dashboard.forms, end: false },
    ],
  },
  {
    label: "Find leads",
    items: [
      { label: "Filters", icon: Filter, href: Routes.dashboard.filters, end: false },
      { label: "Leads Directory", icon: Globe, href: Routes.dashboard.leads_directory, end: false },
    ],
  },
  {
    label: "Outreach",
    items: [
      { label: "Campaigns", icon: Megaphone, href: Routes.dashboard.campaigns, end: false },
      { label: "Sequences", icon: Workflow, href: Routes.dashboard.sequences, end: false },
      { label: "Templates", icon: FileText, href: Routes.dashboard.message_templates, end: false },
      { label: "Send history", icon: Mail, href: Routes.dashboard.send_history, end: false },
      { label: "Sender Profiles", icon: IdCard, href: Routes.dashboard.sender_profiles, end: false },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { label: "Jobs", icon: ListTodo, href: Routes.dashboard.jobs, end: false },
      { label: "Batch Jobs", icon: Layers, href: Routes.dashboard.batch_jobs, end: false },
      { label: "Deliverability", icon: Gauge, href: Routes.dashboard.mail_tester, end: false },
      { label: "Domain Health", icon: Shield, href: Routes.dashboard.mxtoolbox, end: false },
    ],
  },
  {
    label: "Connect",
    items: [
      { label: "Integrations", icon: Plug, href: Routes.dashboard.integrations, end: false },
    ],
  },
];

const adminSubItems: NavItemConfig[] = [
  { label: "Controls", icon: Wrench, href: Routes.dashboard.admin_controls, end: true },
  { label: "System Status", icon: Activity, href: Routes.dashboard.admin_system_status, end: false },
];

const settingsSubItems: NavItemConfig[] = [
  { label: "Account", icon: User, href: Routes.dashboard.settings_account, end: false },
  { label: "Organisation", icon: Building2, href: Routes.dashboard.settings_organisation, end: false },
  { label: "Activity", icon: History, href: Routes.dashboard.settings_activity, end: false },
  { label: "Usage", icon: BarChart2, href: Routes.dashboard.settings_usage, end: false },
];

const allNavItemsByHref = new Map<string, NavItemConfig>(
  [...navGroups.flatMap((group) => group.items), ...adminSubItems, ...settingsSubItems].map(
    (item) => [item.href, item],
  ),
);

const adminHrefs = new Set(adminSubItems.map((item) => item.href));

function pathMatchesAnyAdminRoute(pathname: string) {
  return adminSubItems.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
}

function pathMatchesAnySettingsRoute(pathname: string) {
  return (
    pathname === Routes.dashboard.settings ||
    settingsSubItems.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
  );
}

function NavItem({
  label,
  icon: Icon,
  href,
  end,
  collapsed,
  onNavigate,
  indent = false,
  favorited,
  onToggleFavorite,
  innerRef,
  draggableProps,
  dragHandleProps,
  isDragging,
}: {
  label: string;
  icon: React.ElementType;
  href: string;
  end: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  indent?: boolean;
  favorited?: boolean;
  onToggleFavorite?: () => void;
  innerRef?: (element: HTMLElement | null) => void;
  draggableProps?: DraggableProvidedDraggableProps;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  isDragging?: boolean;
}) {
  return (
    <li
      ref={innerRef}
      {...draggableProps}
      className={cn(
        "group/item flex items-center gap-0.5 rounded-xl",
        indent && !collapsed && "ml-3 w-[calc(100%-12px)]",
        isDragging && "bg-surface shadow-md",
      )}
    >
      {dragHandleProps && !collapsed && (
        <span
          {...dragHandleProps}
          className="shrink-0 cursor-grab text-muted/40 hover:text-muted transition-colors pl-1"
        >
          <GripVertical className="size-3.5" />
        </span>
      )}
      <NavLink
        to={href}
        end={end}
        title={collapsed ? label : undefined}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            "group flex items-center flex-1 min-w-0 rounded-xl transition-all duration-200 outline-none",
            "focus-visible:ring-1 focus-visible:ring-accent/50",
            collapsed ? "justify-center py-2.5 px-0" : "gap-2.5 px-2.5 py-[8px]",
            isActive
              ? "text-foreground"
              : "text-muted hover:text-foreground hover:bg-surface-secondary",
          )
        }
        style={({ isActive }) =>
          isActive
            ? {
                background: "color-mix(in oklch, var(--accent) 12%, transparent)",
                boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--accent) 22%, transparent)",
              }
            : {}
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className="shrink-0 transition-transform duration-200 group-hover:scale-[1.07]"
              style={{ width: 16, height: 16, color: isActive ? "var(--accent)" : undefined }}
            />
            {!collapsed && (
              <span
                className="!text-[14px] font-medium truncate leading-none"
                style={{ letterSpacing: "-0.005em" }}
              >
                {label}
              </span>
            )}
          </>
        )}
      </NavLink>
      {!collapsed && onToggleFavorite && (
        <button
          type="button"
          title={favorited ? "Remove from favorites" : "Add to favorites"}
          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
          onClick={() => onToggleFavorite()}
          className={cn(
            "shrink-0 mr-1 p-1 rounded-md transition-all duration-150",
            "text-muted hover:text-foreground hover:bg-surface-secondary",
            favorited ? "opacity-100" : "opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100",
          )}
        >
          <Star
            className={cn("size-3.5", favorited && "fill-current")}
            style={favorited ? { color: "var(--accent)" } : undefined}
          />
        </button>
      )}
    </li>
  );
}

function NavGroupSection({
  label,
  items,
  collapsed,
  onNavigate,
  showDivider,
  favoritedHrefs,
  onToggleFavorite,
}: {
  label?: string;
  items: NavItemConfig[];
  collapsed: boolean;
  onNavigate?: () => void;
  showDivider: boolean;
  favoritedHrefs: Set<string>;
  onToggleFavorite: (href: string) => void;
}) {
  return (
    <li className={cn(showDivider && "pt-2.5 mt-2.5 border-t border-border")}>
      {label && !collapsed && (
        <p className="px-2.5 pb-1.5 !text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
          {label}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <NavItem
            key={item.href}
            label={item.label}
            icon={item.icon}
            href={item.href}
            end={item.end}
            collapsed={collapsed}
            onNavigate={onNavigate}
            favorited={favoritedHrefs.has(item.href)}
            onToggleFavorite={() => onToggleFavorite(item.href)}
          />
        ))}
      </ul>
    </li>
  );
}

function FavoritesSection({
  items,
  collapsed,
  onNavigate,
  onToggleFavorite,
  onReorder,
}: {
  items: NavItemConfig[];
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleFavorite: (href: string) => void;
  onReorder: (hrefs: string[]) => void;
}) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    const reordered = [...items];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    onReorder(reordered.map((item) => item.href));
  };

  return (
    <li className="pb-2.5 mb-2.5 border-b border-border">
      {!collapsed && (
        <p className="px-2.5 pb-1.5 !text-[12px] font-semibold uppercase tracking-[0.12em] text-muted flex items-center gap-1">
          <Star className="size-3" />
          Favorites
        </p>
      )}
      {collapsed ? (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <NavItem
              key={item.href}
              label={item.label}
              icon={item.icon}
              href={item.href}
              end={item.end}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sidebar-favorites">
            {(provided) => (
              <ul className="space-y-0.5" ref={provided.innerRef} {...provided.droppableProps}>
                {items.map((item, index) => (
                  <Draggable key={item.href} draggableId={item.href} index={index}>
                    {(provided, snapshot) => (
                      <NavItem
                        label={item.label}
                        icon={item.icon}
                        href={item.href}
                        end={item.end}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                        favorited
                        onToggleFavorite={() => onToggleFavorite(item.href)}
                        innerRef={provided.innerRef}
                        draggableProps={provided.draggableProps}
                        dragHandleProps={provided.dragHandleProps}
                        isDragging={snapshot.isDragging}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </li>
  );
}

export default function SidebarContent({ collapsed, onNavigate }: SidebarContentProps) {
  const { pathname } = useLocation();
  const canViewAdminNav = usePermission("admin_nav");
  const prevPathname = useRef(pathname);
  const [adminOpen, setAdminOpen] = useState(() => pathMatchesAnyAdminRoute(pathname));
  const [settingsOpen, setSettingsOpen] = useState(() => pathMatchesAnySettingsRoute(pathname));

  const { data: favorites } = useSidebarFavorites();
  const addFavorite = useAddSidebarFavorite();
  const removeFavorite = useRemoveSidebarFavorite();
  const reorderFavorites = useReorderSidebarFavorites();

  const favoritedHrefs = useMemo(
    () => new Set((favorites ?? []).map((fav) => fav.nav_key)),
    [favorites],
  );

  const favoriteItems = useMemo(
    () =>
      (favorites ?? [])
        .map((fav) => allNavItemsByHref.get(fav.nav_key))
        .filter((item): item is NavItemConfig => Boolean(item))
        .filter((item) => canViewAdminNav || !adminHrefs.has(item.href)),
    [favorites, canViewAdminNav],
  );

  const handleToggleFavorite = (href: string) => {
    if (favoritedHrefs.has(href)) {
      removeFavorite.mutate(href);
    } else {
      addFavorite.mutate(href);
    }
  };

  const handleReorderFavorites = (hrefs: string[]) => {
    reorderFavorites.mutate(hrefs);
  };

  useEffect(() => {
    if (collapsed) {
      setAdminOpen(false);
      setSettingsOpen(false);
    }
  }, [collapsed]);

  useEffect(() => {
    const nowAdmin = pathMatchesAnyAdminRoute(pathname);
    const prevAdmin = pathMatchesAnyAdminRoute(prevPathname.current);
    const nowSettings = pathMatchesAnySettingsRoute(pathname);
    const prevSettings = pathMatchesAnySettingsRoute(prevPathname.current);
    prevPathname.current = pathname;
    if (collapsed) return;
    if (nowAdmin && !prevAdmin) {
      setAdminOpen(true);
    }
    if (nowSettings && !prevSettings) {
      setSettingsOpen(true);
    }
  }, [pathname, collapsed]);

  const disclosureTriggerClass = cn(
    "group flex w-full rounded-xl transition-all duration-200 outline-none",
    "focus-visible:ring-1 focus-visible:ring-accent/50",
    "text-muted hover:text-foreground hover:bg-surface-secondary",
    collapsed ? "justify-center py-2.5 px-0" : "items-center justify-between gap-2 px-2.5 py-[8px]",
  );

  return (
    <ul className="space-y-0">
      {favoriteItems.length > 0 && (
        <FavoritesSection
          items={favoriteItems}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onToggleFavorite={handleToggleFavorite}
          onReorder={handleReorderFavorites}
        />
      )}

      {canViewAdminNav && (
        <li className="pb-2.5 mb-2.5 border-b border-border">
          <Disclosure
            isExpanded={adminOpen}
            onExpandedChange={setAdminOpen}
            className="w-full min-w-0 gap-0"
          >
            <Disclosure.Heading className="w-full p-0 m-0">
              <Disclosure.Trigger
                aria-label={collapsed ? "Admin" : undefined}
                className={disclosureTriggerClass}
              >
                <span
                  className={cn(
                    "flex items-center min-w-0",
                    collapsed ? "justify-center" : "gap-2.5 flex-1",
                  )}
                >
                  <ShieldCheck style={{ width: 16, height: 16 }} className="shrink-0" />
                  {!collapsed && (
                    <span
                      className="text-[13px] font-medium truncate leading-none"
                      style={{ letterSpacing: "-0.005em" }}
                    >
                      Admin
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted transition-transform duration-200",
                      adminOpen && "rotate-180",
                    )}
                  />
                )}
              </Disclosure.Trigger>
            </Disclosure.Heading>
            <Disclosure.Content className="p-0 m-0">
              <Disclosure.Body className="p-0 m-0">
                <ul className="space-y-0.5">
                  {adminSubItems.map(({ label, icon, href, end }) => (
                    <NavItem
                      key={href}
                      label={label}
                      icon={icon}
                      href={href}
                      end={end}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                      indent={true}
                      favorited={favoritedHrefs.has(href)}
                      onToggleFavorite={() => handleToggleFavorite(href)}
                    />
                  ))}
                </ul>
              </Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>
        </li>
      )}

      {navGroups.map((group, index) => (
        <NavGroupSection
          key={group.label ?? group.items[0]?.href ?? index}
          label={group.label}
          items={group.items}
          collapsed={collapsed}
          onNavigate={onNavigate}
          showDivider={index > 0}
          favoritedHrefs={favoritedHrefs}
          onToggleFavorite={handleToggleFavorite}
        />
      ))}

      <li className="pt-2.5 mt-2.5 border-t border-border">
        <Disclosure
          isExpanded={settingsOpen}
          onExpandedChange={setSettingsOpen}
          className="w-full min-w-0 gap-0"
        >
          <Disclosure.Heading className="w-full p-0 m-0">
            <Disclosure.Trigger
              aria-label={collapsed ? "Settings" : undefined}
              className={disclosureTriggerClass}
            >
              <span
                className={cn(
                  "flex items-center min-w-0",
                  collapsed ? "justify-center" : "gap-2.5 flex-1",
                )}
              >
                <Settings style={{ width: 16, height: 16 }} className="shrink-0" />
                {!collapsed && (
                  <span
                    className="text-[13px] font-medium truncate leading-none"
                    style={{ letterSpacing: "-0.005em" }}
                  >
                    Settings
                  </span>
                )}
              </span>
              {!collapsed && (
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted transition-transform duration-200",
                    settingsOpen && "rotate-180",
                  )}
                />
              )}
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content className="p-0 m-0">
            <Disclosure.Body className="p-0 m-0">
              <ul className="space-y-0.5">
                {settingsSubItems.map(({ label, icon, href, end }) => (
                  <NavItem
                    key={href}
                    label={label}
                    icon={icon}
                    href={href}
                    end={end}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                    indent={true}
                    favorited={favoritedHrefs.has(href)}
                    onToggleFavorite={() => handleToggleFavorite(href)}
                  />
                ))}
              </ul>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      </li>
    </ul>
  );
}
