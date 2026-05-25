import type { ComponentType } from 'react'
import Link from 'next/link'
import {
  Bell,
  Building2,
  CalendarDays,
  Car,
  ClipboardList,
  CreditCard,
  FileText,
  Flag,
  Gauge,
  Heart,
  Image,
  LayoutDashboard,
  LifeBuoy,
  ListTree,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Package,
  Rocket,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Utensils,
  Users,
} from 'lucide-react'
import { LogoutButton } from '@/components/admin/logout-button'
import { adminPanelConfig, type AdminEntityConfig } from '@/generated/admin-panel.config'
import {
  canReadEntity,
  hasAnyAdminPermission,
} from '@/lib/admin-permissions'
import type { AdminRole } from '@/lib/server/auth'
import { cn } from '@/lib/utils'

const hasCommerceOperations =
  adminPanelConfig.entities.some(
    entity => entity.key === 'orders' || entity.route === 'orders',
  ) &&
  adminPanelConfig.entities.some(
    entity => entity.key === 'products' || entity.route === 'products',
  )
const hasSocialModeration =
  ['socialNetwork', 'instagram', 'tiktok'].includes(adminPanelConfig.mobileApp) ||
  adminPanelConfig.entities.some(entity =>
    ['posts', 'comments', 'stories'].includes(entity.route),
  )
const hasAppointmentOperations =
  [
    'appointmentsAllInOne',
    'appointmentsConsumer',
    'appointmentsProfessional',
    'appointmentsVendorManager',
  ].includes(adminPanelConfig.mobileApp) ||
  (
    adminPanelConfig.entities.some(entity => entity.route === 'bookings') &&
    adminPanelConfig.entities.some(entity => entity.route === 'providers')
  )
const hasTaxiOperations =
  ['taxiRider', 'taxiDriver'].includes(adminPanelConfig.mobileApp) ||
  (
    adminPanelConfig.entities.some(entity => entity.route === 'trips') &&
    adminPanelConfig.entities.some(entity => entity.route === 'car-categories')
  )
const hasListingOperations =
  ['realEstate', 'storeLocator', 'ulistings'].includes(adminPanelConfig.mobileApp) ||
  (
    adminPanelConfig.entities.some(entity => entity.route === 'listings') &&
    adminPanelConfig.entities.some(entity => entity.route === 'categories')
  )
const hasDatingSafety =
  adminPanelConfig.mobileApp === 'dating' ||
  (
    adminPanelConfig.entities.some(entity => entity.route === 'reports') &&
    adminPanelConfig.entities.some(entity => entity.route === 'swipes')
  )
const hasMessagingOperations =
  adminPanelConfig.features.includes('chat') ||
  ['chat', 'gptchat', 'videoChat'].includes(adminPanelConfig.mobileApp) ||
  adminPanelConfig.entities.some(entity => entity.route === 'chats')

const tools = [
  {
    href: '/admin/launch-checklist',
    icon: Rocket,
    label: 'Launch Checklist',
    permissions: ['launch.read'],
  },
  {
    href: '/admin/settings',
    icon: Settings,
    label: 'App Settings',
    permissions: ['settings.read', 'settings.write'],
  },
  {
    href: '/admin/audit-log',
    icon: ClipboardList,
    label: 'Audit Log',
    permissions: ['audit.read'],
  },
  {
    href: '/admin/admins',
    icon: ShieldCheck,
    label: 'Admin Roles',
    permissions: ['admin_roles.manage'],
    roles: ['owner'],
  },
  {
    href: '/admin/support',
    icon: LifeBuoy,
    label: 'Support',
    permissions: ['support.read', 'support.write'],
  },
  {
    href: '/admin/campaigns',
    icon: Megaphone,
    label: 'Campaigns',
    permissions: ['campaigns.read', 'campaigns.write'],
  },
  {
    feature: 'uploads',
    href: '/admin/media-library',
    icon: Image,
    label: 'Media Library',
    permissions: ['media.read', 'media.write', 'entities.write'],
  },
  {
    enabled: hasCommerceOperations,
    href: '/admin/commerce',
    icon: ShoppingCart,
    label: 'Commerce',
    permissions: ['operations.read', 'operations.write'],
  },
  {
    enabled: hasSocialModeration,
    href: '/admin/moderation',
    icon: Flag,
    label: 'Moderation',
    permissions: ['moderation.read', 'moderation.write'],
  },
  {
    enabled: hasAppointmentOperations,
    href: '/admin/appointments',
    icon: CalendarDays,
    label: 'Appointments',
    permissions: ['operations.read', 'operations.write'],
  },
  {
    enabled: hasTaxiOperations,
    href: '/admin/taxi',
    icon: Car,
    label: 'Taxi',
    permissions: ['operations.read', 'operations.write'],
  },
  {
    enabled: hasListingOperations,
    href: '/admin/listings-operations',
    icon: Building2,
    label: 'Listings Ops',
    permissions: ['operations.read', 'operations.write'],
  },
  {
    enabled: hasDatingSafety,
    href: '/admin/dating-safety',
    icon: ShieldAlert,
    label: 'Dating Safety',
    permissions: ['moderation.read', 'moderation.write'],
  },
  {
    enabled: hasMessagingOperations,
    href: '/admin/messaging',
    icon: MessageCircle,
    label: 'Messaging',
    permissions: ['messaging.read', 'messaging.write'],
  },
  {
    feature: 'push',
    href: '/admin/sendNotification',
    icon: Bell,
    label: 'Push Notifications',
    permissions: ['notifications.write'],
  },
  {
    feature: 'email',
    href: '/admin/sendEmail',
    icon: Mail,
    label: 'E-mail',
    permissions: ['email.write'],
  },
]

const hiddenEntityKeys = new Set(
  adminPanelConfig.features.includes('email') ? ['emailTemplates'] : [],
)

const entityIconMap = {
  bookings: CreditCard,
  carCategories: Car,
  categories: Tag,
  channels: MessageSquare,
  comments: MessageCircle,
  deliveryOrders: ShoppingBag,
  emailTemplates: FileText,
  filters: ListTree,
  foodCategories: Utensils,
  listings: Building2,
  matches: Heart,
  orders: ShoppingBag,
  photos: Image,
  posts: Newspaper,
  products: Package,
  reactions: Heart,
  recommendations: Sparkles,
  reports: Flag,
  reviews: Star,
  savedPlaces: MapPin,
  subscriptions: CreditCard,
  swipeCounts: Gauge,
  swipes: MessageCircle,
  notifications: Bell,
  stories: Image,
  trips: MapPin,
  users: Users,
} satisfies Record<string, ComponentType<{ className?: string }>>

function getEntityIcon(entity: AdminEntityConfig) {
  return (
    entityIconMap[entity.key as keyof typeof entityIconMap] ??
    entityIconMap[entity.route as keyof typeof entityIconMap] ??
    ListTree
  )
}

function NavLinks({ adminRole }: { adminRole: AdminRole }) {
  return (
    <>
      <Link
        href="/admin"
        className="flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        <span className="truncate">Dashboard</span>
      </Link>
      {adminPanelConfig.entities
        .filter(entity => !hiddenEntityKeys.has(entity.key))
        .filter(entity => canReadEntity(adminRole, entity))
        .map(entity => {
          const Icon = getEntityIcon(entity)

          return (
            <Link
              key={entity.key}
              href={`/admin/${entity.route}`}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{entity.displayName}</span>
            </Link>
          )
        })}
      {tools
        .filter(tool => {
          const isEnabled = tool.enabled !== false
          const hasFeature = !tool.feature || adminPanelConfig.features.includes(tool.feature)
          const hasRole = !tool.roles || tool.roles.includes(adminRole)
          const hasPermission =
            !tool.permissions || hasAnyAdminPermission(adminRole, tool.permissions)
          return isEnabled && hasFeature && hasRole && hasPermission
        })
        .map(tool => {
          const Icon = tool.icon

          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{tool.label}</span>
            </Link>
          )
        })}
    </>
  )
}

export function AdminShell({
  adminRole,
  children,
}: Readonly<{
  adminRole: AdminRole
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card md:block">
        <div className="flex h-16 items-center border-b px-5">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{adminPanelConfig.theme.appName}</div>
            <div className="text-xs text-muted-foreground">{adminPanelConfig.slug}</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          <NavLinks adminRole={adminRole} />
        </nav>
      </aside>
      <main className="min-w-0 min-h-screen md:pl-64">
        <div className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur md:justify-end md:px-8">
          <details className="group relative md:hidden">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border px-3 text-sm font-medium marker:hidden">
              <Menu className="h-4 w-4" />
              Menu
            </summary>
            <nav className="absolute left-0 top-11 z-30 w-[min(20rem,calc(100vw-1.5rem))] rounded-md border bg-card p-2 shadow-lg">
              <NavLinks adminRole={adminRole} />
            </nav>
          </details>
          <LogoutButton />
        </div>
        <div className="mx-auto w-full max-w-7xl p-3 sm:p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
