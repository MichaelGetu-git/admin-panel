export type AdminFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'photo'
  | 'photos'
  | 'media'
  | 'color'
  | 'location'
  | 'richText'
  | 'array'
  | 'object'
  | 'foreignKey'
  | 'foreignKeys'

export interface AdminFieldConfig {
  type: AdminFieldType
  label: string
  required?: boolean
  description?: string
  defaultValue?: unknown
  display?: {
    list?: boolean
    create?: boolean
    update?: boolean
    view?: boolean
  }
  options?: string[]
  itemType?: Exclude<AdminFieldType, 'array' | 'foreignKeys'>
  entity?: string
  titleField?: string
}

export interface AdminEntityConfig {
  key: string
  displayName: string
  collection: string
  collectionGroups: string[]
  route: string
  singularName: string
  pluralName: string
  titleField: string
  listFields: string[]
  access: 'readWrite' | 'readOnly'
  orderBy: {
    field: string
    direction: 'asc' | 'desc'
  } | null
  typeaheadFields: string[]
  fields: Record<string, AdminFieldConfig>
}

export type AdminDashboardWidgetKind = 'activity' | 'audit' | 'business' | 'pending' | 'users'

export type AdminDashboardMetric =
  | 'activeUsers'
  | 'auditEvents'
  | 'engagementRate'
  | 'entityCount'
  | 'pendingCount'
  | 'totalUsers'

export interface AdminDashboardWidgetConfig {
  description: string
  entity?: string
  href?: string
  id: string
  kind: AdminDashboardWidgetKind
  label: string
  metric: AdminDashboardMetric
  valueSuffix?: string
}

export interface AdminDashboardConfig {
  widgets: AdminDashboardWidgetConfig[]
}

export type AdminCampaignSegmentRule =
  | {
      type: 'allUsers'
    }
  | {
      days: number
      type: 'newUsers'
    }
  | {
      days: number
      type: 'inactiveUsers'
    }
  | {
      fieldExistsAny?: string[]
      roles: string[]
      type: 'roleAny'
    }

export interface AdminCampaignSegmentConfig {
  description: string
  id: string
  label: string
  rule: AdminCampaignSegmentRule
}

export type AdminLaunchCheckValidator =
  | 'adminAccess'
  | 'appSettings'
  | 'auditLog'
  | 'campaignSegments'
  | 'firebaseAdminConfig'
  | 'ownerAdmin'
  | 'requiredEnv'
  | 'starterContent'
  | 'storage'
  | 'supportCockpit'

export interface AdminLaunchChecklistItemConfig {
  blockedDescription?: string
  description: string
  feature?: string
  href?: string
  id: string
  label: string
  readyDescription?: string
  requiredEnv?: string[]
  validator: AdminLaunchCheckValidator
  warningDescription?: string
}

export interface AdminSettingsFieldConfig {
  defaultValue?: unknown
  group?: string
  key: string
  label: string
  required?: boolean
  type: 'boolean' | 'color' | 'email' | 'phone' | 'string' | 'url'
}

export interface AdminActionConfig {
  confirm?: boolean
  entity?: string
  field?: string
  id: string
  label: string
  operation?: 'delete'
  resource?: string
  route?: string
  serverAction?:
    | 'appointments.bookingStatus'
    | 'commerce.driverAvailability'
    | 'commerce.orderStatus'
    | 'datingSafety.action'
    | 'listing.action'
    | 'messaging.action'
    | 'socialModeration.action'
    | 'support.userAction'
    | 'taxi.clearStuckState'
    | 'taxi.driverAvailability'
    | 'taxi.tripStatus'
  type: 'bulk' | 'entity' | 'server' | 'setField'
  value?: unknown
}

export interface AdminWorkflowConfig {
  actions: string[]
  description?: string
  entity?: string
  id: string
  label: string
}

export interface AdminImportExportConfig {
  entity: string
  fields?: string[]
  id: string
  label: string
  type: 'csv' | 'json'
}

export interface AdminAuditConfig {
  enabled: boolean
  criticalActions: string[]
}

export interface AdminPanelConfig {
  slug: string
  displayName: string
  mobileApp: string
  features: string[]
  theme: {
    appName: string
    preset: string
    logoPath?: string
    radius?: string
    density?: string
    light?: Record<string, string>
    dark?: Record<string, string>
  }
  entities: AdminEntityConfig[]
  actions: AdminActionConfig[]
  audit: AdminAuditConfig
  dashboard: AdminDashboardConfig
  exports: AdminImportExportConfig[]
  imports: AdminImportExportConfig[]
  launchChecklist: AdminLaunchChecklistItemConfig[]
  rolePermissions: Record<string, string[]>
  segments: AdminCampaignSegmentConfig[]
  settings: AdminSettingsFieldConfig[]
  workflows: AdminWorkflowConfig[]
}

export const adminPanelConfig: AdminPanelConfig = {
  "slug": "store-locator-admin-panel",
  "displayName": "Store Locator Admin Panel",
  "mobileApp": "storeLocator",
  "features": [
    "users",
    "chat",
    "email",
    "push",
    "templates",
    "dashboard",
    "uploads"
  ],
  "theme": {
    "preset": "listings",
    "appName": "Store Locator Admin",
    "radius": "0.5rem",
    "density": "comfortable",
    "light": {
      "primary": "172 66% 26%",
      "accent": "172 70% 94%",
      "ring": "172 66% 26%"
    }
  },
  "entities": [
    {
      "key": "users",
      "displayName": "Users",
      "collection": "users",
      "collectionGroups": [],
      "route": "users",
      "singularName": "user",
      "pluralName": "users",
      "titleField": "email",
      "listFields": [
        "profilePictureURL",
        "email",
        "role",
        "createdAt"
      ],
      "access": "readWrite",
      "orderBy": {
        "field": "createdAt",
        "direction": "desc"
      },
      "typeaheadFields": [
        "profilePictureURL",
        "email"
      ],
      "fields": {
        "email": {
          "type": "string",
          "label": "Email",
          "required": true
        },
        "userID": {
          "type": "string",
          "label": "User ID"
        },
        "userId": {
          "type": "string",
          "label": "User Id"
        },
        "username": {
          "type": "string",
          "label": "Username"
        },
        "firstName": {
          "type": "string",
          "label": "First Name"
        },
        "lastName": {
          "type": "string",
          "label": "Last Name"
        },
        "phone": {
          "type": "string",
          "label": "Phone"
        },
        "role": {
          "type": "enum",
          "label": "Role",
          "options": [
            "admin",
            "customer",
            "driver",
            "vendor",
            "user"
          ]
        },
        "profilePictureURL": {
          "type": "photo",
          "label": "Avatar"
        },
        "pushToken": {
          "type": "string",
          "label": "Push Token"
        },
        "pushKitToken": {
          "type": "string",
          "label": "PushKit Token"
        },
        "badgeCount": {
          "type": "number",
          "label": "Badge Count"
        },
        "isOnline": {
          "type": "boolean",
          "label": "Online"
        },
        "isActive": {
          "type": "boolean",
          "label": "Active"
        },
        "vendorID": {
          "type": "string",
          "label": "Vendor ID"
        },
        "inProgressOrderID": {
          "type": "string",
          "label": "In Progress Order ID"
        },
        "orderRequestData": {
          "type": "object",
          "label": "Order Request Data"
        },
        "shippingAddress": {
          "type": "object",
          "label": "Shipping Address"
        },
        "wishlist": {
          "type": "array",
          "label": "Wishlist",
          "itemType": "object"
        },
        "location": {
          "type": "location",
          "label": "Location"
        },
        "photos": {
          "type": "photos",
          "label": "Photos"
        },
        "professionalVendorID": {
          "type": "string",
          "label": "Professional Vendor ID"
        },
        "professionalCategoryID": {
          "type": "string",
          "label": "Professional Category ID"
        },
        "professionalSkills": {
          "type": "array",
          "label": "Professional Skills",
          "itemType": "object"
        },
        "professionalSpecialty": {
          "type": "string",
          "label": "Professional Specialty"
        },
        "pricePerHr": {
          "type": "string",
          "label": "Professional Price Per Hour"
        },
        "bio": {
          "type": "richText",
          "label": "Bio"
        },
        "isFeatured": {
          "type": "boolean",
          "label": "Featured Professional"
        },
        "carName": {
          "type": "string",
          "label": "Car Name"
        },
        "carNumber": {
          "type": "string",
          "label": "Car Number"
        },
        "carType": {
          "type": "string",
          "label": "Car Type"
        },
        "ratings": {
          "type": "number",
          "label": "Ratings"
        },
        "ratingsCount": {
          "type": "number",
          "label": "Ratings Count"
        },
        "savedPlaces": {
          "type": "array",
          "label": "Saved Places",
          "itemType": "object"
        },
        "defaultPaymentKey": {
          "type": "string",
          "label": "Default Payment"
        },
        "createdAt": {
          "type": "date",
          "label": "Registration Date"
        },
        "updatedAt": {
          "type": "date",
          "label": "Updated At"
        },
        "lastOnlineTimestamp": {
          "type": "number",
          "label": "Last Online Timestamp"
        }
      }
    },
    {
      "key": "channels",
      "displayName": "Chats",
      "collection": "channels",
      "collectionGroups": [],
      "route": "chats",
      "singularName": "channel",
      "pluralName": "channels",
      "titleField": "name",
      "listFields": [
        "name",
        "lastMessage",
        "createdAt"
      ],
      "access": "readOnly",
      "orderBy": {
        "field": "createdAt",
        "direction": "desc"
      },
      "typeaheadFields": [],
      "fields": {
        "name": {
          "type": "string",
          "label": "Name"
        },
        "lastMessage": {
          "type": "string",
          "label": "Last Message"
        },
        "participantIDs": {
          "type": "array",
          "label": "Participants",
          "itemType": "string"
        },
        "adminReviewedAt": {
          "type": "number",
          "label": "Admin Reviewed At"
        },
        "adminEscalated": {
          "type": "boolean",
          "label": "Admin Escalated"
        },
        "adminSupportHandoff": {
          "type": "boolean",
          "label": "Support Follow-up"
        },
        "createdAt": {
          "type": "date",
          "label": "Created At"
        }
      }
    },
    {
      "key": "emailTemplates",
      "displayName": "Email Templates",
      "collection": "email_templates",
      "collectionGroups": [],
      "route": "templates",
      "singularName": "template",
      "pluralName": "templates",
      "titleField": "title",
      "listFields": [
        "title",
        "description",
        "createdAt"
      ],
      "access": "readWrite",
      "orderBy": {
        "field": "createdAt",
        "direction": "desc"
      },
      "typeaheadFields": [],
      "fields": {
        "title": {
          "type": "string",
          "label": "Title",
          "required": true
        },
        "description": {
          "type": "string",
          "label": "Description"
        },
        "html": {
          "type": "richText",
          "label": "HTML",
          "required": true
        },
        "photos": {
          "type": "photos",
          "label": "Photos"
        },
        "createdAt": {
          "type": "date",
          "label": "Created At"
        }
      }
    },
    {
      "key": "categories",
      "displayName": "Categories",
      "collection": "store_locator_categories",
      "collectionGroups": [],
      "route": "categories",
      "singularName": "category",
      "pluralName": "categories",
      "titleField": "name",
      "listFields": [
        "photo",
        "name",
        "description",
        "order"
      ],
      "access": "readWrite",
      "orderBy": null,
      "typeaheadFields": [
        "photo",
        "name"
      ],
      "fields": {
        "name": {
          "type": "string",
          "label": "Name",
          "required": true
        },
        "description": {
          "type": "string",
          "label": "Description"
        },
        "photo": {
          "type": "photo",
          "label": "Photo",
          "required": true
        },
        "order": {
          "type": "string",
          "label": "Order"
        },
        "createdAt": {
          "type": "date",
          "label": "Created At"
        }
      }
    },
    {
      "key": "filters",
      "displayName": "Filters",
      "collection": "store_locator_filters",
      "collectionGroups": [],
      "route": "filters",
      "singularName": "filter",
      "pluralName": "filters",
      "titleField": "name",
      "listFields": [
        "name",
        "categories",
        "options"
      ],
      "access": "readWrite",
      "orderBy": null,
      "typeaheadFields": [],
      "fields": {
        "name": {
          "type": "string",
          "label": "Name",
          "required": true
        },
        "options": {
          "type": "array",
          "label": "Options",
          "itemType": "object"
        },
        "categories": {
          "type": "foreignKeys",
          "label": "Categories",
          "entity": "categories"
        }
      }
    },
    {
      "key": "listings",
      "displayName": "Listings",
      "collection": "store_locator_listings",
      "collectionGroups": [],
      "route": "listings",
      "singularName": "listing",
      "pluralName": "listings",
      "titleField": "title",
      "listFields": [
        "photo",
        "title",
        "authorID",
        "categoryID",
        "place",
        "starCount",
        "price",
        "isApproved",
        "createdAt"
      ],
      "access": "readWrite",
      "orderBy": {
        "field": "createdAt",
        "direction": "desc"
      },
      "typeaheadFields": [
        "photo",
        "title"
      ],
      "fields": {
        "title": {
          "type": "string",
          "label": "Title",
          "required": true
        },
        "authorID": {
          "type": "foreignKey",
          "label": "Author",
          "entity": "users",
          "titleField": "firstName",
          "required": true
        },
        "categoryID": {
          "type": "foreignKey",
          "label": "Category",
          "entity": "categories",
          "titleField": "name",
          "required": true
        },
        "description": {
          "type": "richText",
          "label": "Description",
          "required": true
        },
        "author": {
          "type": "object",
          "label": "Author Snapshot"
        },
        "authorName": {
          "type": "string",
          "label": "Author Name"
        },
        "authorProfilePic": {
          "type": "photo",
          "label": "Author Avatar"
        },
        "categoryTitle": {
          "type": "string",
          "label": "Category Title"
        },
        "categoryPhoto": {
          "type": "photo",
          "label": "Category Photo"
        },
        "place": {
          "type": "string",
          "label": "Place"
        },
        "location": {
          "type": "string",
          "label": "Location"
        },
        "latitude": {
          "type": "number",
          "label": "Latitude"
        },
        "longitude": {
          "type": "number",
          "label": "Longitude"
        },
        "coordinate": {
          "type": "object",
          "label": "Coordinate"
        },
        "starCount": {
          "type": "number",
          "label": "Stars"
        },
        "price": {
          "type": "string",
          "label": "Price",
          "required": true
        },
        "filters": {
          "type": "object",
          "label": "Filters"
        },
        "isApproved": {
          "type": "boolean",
          "label": "Approved"
        },
        "isFeatured": {
          "type": "boolean",
          "label": "Featured"
        },
        "featured": {
          "type": "boolean",
          "label": "Featured Legacy Flag"
        },
        "isPromoted": {
          "type": "boolean",
          "label": "Promoted"
        },
        "promoted": {
          "type": "boolean",
          "label": "Promoted Legacy Flag"
        },
        "photo": {
          "type": "photo",
          "label": "Cover Photo",
          "required": true
        },
        "photos": {
          "type": "photos",
          "label": "Photos",
          "required": true
        },
        "photoURLs": {
          "type": "photos",
          "label": "Photo URLs"
        },
        "reviewsCount": {
          "type": "number",
          "label": "Reviews Count"
        },
        "reviewsSum": {
          "type": "number",
          "label": "Reviews Sum"
        },
        "createdAt": {
          "type": "date",
          "label": "Created At"
        }
      }
    },
    {
      "key": "reviews",
      "displayName": "Reviews",
      "collection": "store_locator_reviews",
      "collectionGroups": [],
      "route": "reviews",
      "singularName": "review",
      "pluralName": "reviews",
      "titleField": "content",
      "listFields": [
        "authorID",
        "listingID",
        "content",
        "starCount",
        "createdAt"
      ],
      "access": "readWrite",
      "orderBy": {
        "field": "createdAt",
        "direction": "desc"
      },
      "typeaheadFields": [],
      "fields": {
        "authorID": {
          "type": "foreignKey",
          "label": "Author",
          "entity": "users",
          "titleField": "firstName",
          "required": true
        },
        "listingID": {
          "type": "foreignKey",
          "label": "Listing",
          "entity": "listings",
          "titleField": "title",
          "required": true
        },
        "content": {
          "type": "richText",
          "label": "Content"
        },
        "starCount": {
          "type": "number",
          "label": "Stars"
        },
        "createdAt": {
          "type": "date",
          "label": "Created At"
        }
      }
    },
    {
      "key": "savedListings",
      "displayName": "Saved Listings",
      "collection": "store_locator_saved_listings",
      "collectionGroups": [],
      "route": "saved_listings",
      "singularName": "saved_listing",
      "pluralName": "saved_listings",
      "titleField": "listingID",
      "listFields": [
        "listingID",
        "userID",
        "createdAt"
      ],
      "access": "readWrite",
      "orderBy": {
        "field": "createdAt",
        "direction": "desc"
      },
      "typeaheadFields": [],
      "fields": {
        "listingID": {
          "type": "foreignKey",
          "label": "Listing",
          "entity": "listings",
          "titleField": "title",
          "required": true
        },
        "userID": {
          "type": "foreignKey",
          "label": "User",
          "entity": "users",
          "titleField": "email",
          "required": true
        },
        "createdAt": {
          "type": "date",
          "label": "Created At"
        }
      }
    }
  ],
  "actions": [
    {
      "entity": "users",
      "field": "isFeatured",
      "id": "users_feature",
      "label": "Feature",
      "type": "setField",
      "value": true
    },
    {
      "entity": "users",
      "field": "isActive",
      "id": "users_activate",
      "label": "Activate",
      "type": "setField",
      "value": true
    },
    {
      "confirm": false,
      "entity": "users",
      "id": "users_reset_badge",
      "label": "Reset Badge",
      "serverAction": "support.userAction",
      "type": "server",
      "value": "reset_badge"
    },
    {
      "confirm": true,
      "entity": "users",
      "id": "users_disable_account",
      "label": "Disable Account",
      "serverAction": "support.userAction",
      "type": "server",
      "value": "disable_account"
    },
    {
      "confirm": false,
      "entity": "users",
      "id": "users_enable_account",
      "label": "Enable Account",
      "serverAction": "support.userAction",
      "type": "server",
      "value": "enable_account"
    },
    {
      "confirm": true,
      "entity": "users",
      "id": "users_delete",
      "label": "Delete",
      "operation": "delete",
      "type": "bulk"
    },
    {
      "confirm": false,
      "entity": "channels",
      "id": "channels_mark_reviewed",
      "label": "Mark Reviewed",
      "serverAction": "messaging.action",
      "type": "server",
      "value": "mark_reviewed"
    },
    {
      "confirm": false,
      "entity": "channels",
      "id": "channels_mark_escalated",
      "label": "Escalate",
      "serverAction": "messaging.action",
      "type": "server",
      "value": "mark_escalated"
    },
    {
      "confirm": false,
      "entity": "channels",
      "id": "channels_clear_escalation",
      "label": "Clear Escalation",
      "serverAction": "messaging.action",
      "type": "server",
      "value": "clear_escalation"
    },
    {
      "confirm": false,
      "entity": "channels",
      "id": "channels_support_handoff",
      "label": "Mark Support Follow-up",
      "serverAction": "messaging.action",
      "type": "server",
      "value": "mark_support_handoff"
    },
    {
      "confirm": false,
      "entity": "channels",
      "id": "channels_clear_support_handoff",
      "label": "Clear Support Follow-up",
      "serverAction": "messaging.action",
      "type": "server",
      "value": "clear_support_handoff"
    },
    {
      "confirm": true,
      "entity": "emailTemplates",
      "id": "emailTemplates_delete",
      "label": "Delete",
      "operation": "delete",
      "type": "bulk"
    },
    {
      "confirm": true,
      "entity": "categories",
      "id": "categories_delete",
      "label": "Delete",
      "operation": "delete",
      "type": "bulk"
    },
    {
      "confirm": true,
      "entity": "filters",
      "id": "filters_delete",
      "label": "Delete",
      "operation": "delete",
      "type": "bulk"
    },
    {
      "entity": "listings",
      "field": "isApproved",
      "id": "listings_approve",
      "label": "Approve",
      "type": "setField",
      "value": true
    },
    {
      "entity": "listings",
      "field": "isFeatured",
      "id": "listings_feature",
      "label": "Feature",
      "type": "setField",
      "value": true
    },
    {
      "confirm": false,
      "entity": "listings",
      "id": "listings_approve_listing",
      "label": "Approve Listing",
      "serverAction": "listing.action",
      "type": "server",
      "value": "approve"
    },
    {
      "confirm": false,
      "entity": "listings",
      "id": "listings_hide_listing",
      "label": "Hide Listing",
      "serverAction": "listing.action",
      "type": "server",
      "value": "hide"
    },
    {
      "confirm": false,
      "entity": "listings",
      "id": "listings_feature_listing",
      "label": "Feature Listing",
      "serverAction": "listing.action",
      "type": "server",
      "value": "feature"
    },
    {
      "confirm": false,
      "entity": "listings",
      "id": "listings_unfeature_listing",
      "label": "Unfeature Listing",
      "serverAction": "listing.action",
      "type": "server",
      "value": "unfeature"
    },
    {
      "confirm": false,
      "entity": "listings",
      "id": "listings_promote_listing",
      "label": "Promote Listing",
      "serverAction": "listing.action",
      "type": "server",
      "value": "promote"
    },
    {
      "confirm": false,
      "entity": "listings",
      "id": "listings_unpromote_listing",
      "label": "Unpromote Listing",
      "serverAction": "listing.action",
      "type": "server",
      "value": "unpromote"
    },
    {
      "confirm": false,
      "entity": "listings",
      "id": "listings_recalculate_rating",
      "label": "Recalculate Rating",
      "serverAction": "listing.action",
      "type": "server",
      "value": "recalculate_rating"
    },
    {
      "confirm": true,
      "entity": "listings",
      "id": "listings_clear_saved",
      "label": "Clear Saved References",
      "serverAction": "listing.action",
      "type": "server",
      "value": "clear_saved_references"
    },
    {
      "confirm": true,
      "entity": "listings",
      "id": "listings_delete",
      "label": "Delete",
      "operation": "delete",
      "type": "bulk"
    },
    {
      "confirm": true,
      "entity": "reviews",
      "id": "reviews_delete",
      "label": "Delete",
      "operation": "delete",
      "type": "bulk"
    },
    {
      "confirm": true,
      "entity": "savedListings",
      "id": "savedListings_delete",
      "label": "Delete",
      "operation": "delete",
      "type": "bulk"
    }
  ],
  "audit": {
    "enabled": true,
    "criticalActions": []
  },
  "dashboard": {
    "widgets": [
      {
        "description": "All registered accounts.",
        "href": "/admin/users",
        "id": "total_users",
        "kind": "users",
        "label": "Total Users",
        "metric": "totalUsers"
      },
      {
        "description": "Sample of users with recent session, token or active status.",
        "href": "/admin/users",
        "id": "active_users",
        "kind": "activity",
        "label": "Active Users",
        "metric": "activeUsers"
      },
      {
        "description": "Records in Categories.",
        "entity": "categories",
        "href": "/admin/categories",
        "id": "primary_business_records",
        "kind": "business",
        "label": "Categories",
        "metric": "entityCount"
      },
      {
        "description": "Items that likely need an admin decision.",
        "id": "pending_work",
        "kind": "pending",
        "label": "Pending Work",
        "metric": "pendingCount"
      },
      {
        "description": "Admin actions captured for accountability.",
        "href": "/admin/audit-log",
        "id": "audit_events",
        "kind": "audit",
        "label": "Audit Events",
        "metric": "auditEvents"
      }
    ]
  },
  "exports": [
    {
      "entity": "users",
      "fields": [
        "profilePictureURL",
        "email",
        "role",
        "createdAt"
      ],
      "id": "users_csv_export",
      "label": "Users CSV Export",
      "type": "csv"
    },
    {
      "entity": "channels",
      "fields": [
        "name",
        "lastMessage",
        "createdAt"
      ],
      "id": "channels_csv_export",
      "label": "Chats CSV Export",
      "type": "csv"
    },
    {
      "entity": "emailTemplates",
      "fields": [
        "title",
        "description",
        "createdAt"
      ],
      "id": "emailTemplates_csv_export",
      "label": "Email Templates CSV Export",
      "type": "csv"
    },
    {
      "entity": "categories",
      "fields": [
        "photo",
        "name",
        "description",
        "order"
      ],
      "id": "categories_csv_export",
      "label": "Categories CSV Export",
      "type": "csv"
    },
    {
      "entity": "filters",
      "fields": [
        "name",
        "categories",
        "options"
      ],
      "id": "filters_csv_export",
      "label": "Filters CSV Export",
      "type": "csv"
    },
    {
      "entity": "listings",
      "fields": [
        "photo",
        "title",
        "authorID",
        "categoryID",
        "place",
        "starCount",
        "price",
        "isApproved",
        "createdAt"
      ],
      "id": "listings_csv_export",
      "label": "Listings CSV Export",
      "type": "csv"
    },
    {
      "entity": "reviews",
      "fields": [
        "authorID",
        "listingID",
        "content",
        "starCount",
        "createdAt"
      ],
      "id": "reviews_csv_export",
      "label": "Reviews CSV Export",
      "type": "csv"
    },
    {
      "entity": "savedListings",
      "fields": [
        "listingID",
        "userID",
        "createdAt"
      ],
      "id": "savedListings_csv_export",
      "label": "Saved Listings CSV Export",
      "type": "csv"
    }
  ],
  "imports": [
    {
      "entity": "users",
      "fields": [
        "profilePictureURL",
        "email",
        "role",
        "createdAt"
      ],
      "id": "users_csv_import",
      "label": "Users CSV Import",
      "type": "csv"
    },
    {
      "entity": "emailTemplates",
      "fields": [
        "title",
        "description",
        "createdAt"
      ],
      "id": "emailTemplates_csv_import",
      "label": "Email Templates CSV Import",
      "type": "csv"
    },
    {
      "entity": "categories",
      "fields": [
        "photo",
        "name",
        "description",
        "order"
      ],
      "id": "categories_csv_import",
      "label": "Categories CSV Import",
      "type": "csv"
    },
    {
      "entity": "filters",
      "fields": [
        "name",
        "categories",
        "options"
      ],
      "id": "filters_csv_import",
      "label": "Filters CSV Import",
      "type": "csv"
    },
    {
      "entity": "listings",
      "fields": [
        "photo",
        "title",
        "authorID",
        "categoryID",
        "place",
        "starCount",
        "price",
        "isApproved",
        "createdAt"
      ],
      "id": "listings_csv_import",
      "label": "Listings CSV Import",
      "type": "csv"
    },
    {
      "entity": "reviews",
      "fields": [
        "authorID",
        "listingID",
        "content",
        "starCount",
        "createdAt"
      ],
      "id": "reviews_csv_import",
      "label": "Reviews CSV Import",
      "type": "csv"
    },
    {
      "entity": "savedListings",
      "fields": [
        "listingID",
        "userID",
        "createdAt"
      ],
      "id": "savedListings_csv_import",
      "label": "Saved Listings CSV Import",
      "type": "csv"
    }
  ],
  "launchChecklist": [
    {
      "blockedDescription": "Missing public Firebase environment variables.",
      "description": "Login and Firebase browser SDK have the public config they need.",
      "id": "firebase-public-config",
      "label": "Firebase public config",
      "readyDescription": "Login and Firebase browser SDK have the public config they need.",
      "requiredEnv": [
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID"
      ],
      "validator": "requiredEnv"
    },
    {
      "description": "Server Firebase Admin credentials are configured.",
      "id": "firebase-admin-config",
      "label": "Firebase Admin config",
      "readyDescription": "Server Firebase Admin credentials are configured.",
      "validator": "firebaseAdminConfig",
      "warningDescription": "Server Firebase Admin credentials are not explicit. Hosted workload identity can still work, but configure credentials for local launch QA."
    },
    {
      "description": "Current session passed the admin access gate.",
      "id": "admin-access",
      "label": "Admin access",
      "validator": "adminAccess"
    },
    {
      "description": "At least one owner admin role is configured.",
      "href": "/admin/admins",
      "id": "admin-roles",
      "label": "Admin roles",
      "readyDescription": "At least one owner admin role is configured.",
      "validator": "ownerAdmin",
      "warningDescription": "Add an owner in Admin Roles so launch access is not tied to one local setup."
    },
    {
      "description": "Recent admin actions are being written to the audit log.",
      "href": "/admin/audit-log",
      "id": "audit-log",
      "label": "Audit log",
      "readyDescription": "Recent admin actions are being written to the audit log.",
      "validator": "auditLog",
      "warningDescription": "No admin audit events exist yet. Perform a safe write action before production operations."
    },
    {
      "description": "Firebase Storage bucket is reachable from the server.",
      "id": "storage-upload",
      "label": "Storage upload",
      "readyDescription": "Firebase Storage bucket is reachable from the server.",
      "validator": "storage",
      "warningDescription": "Storage bucket was not reachable. Set FIREBASE_STORAGE_BUCKET and service account access before launch."
    },
    {
      "description": "Email feature is enabled and needs a SendGrid key for broadcast email.",
      "feature": "email",
      "href": "/admin/sendEmail",
      "id": "email-broadcast",
      "label": "Email broadcast",
      "readyDescription": "SendGrid key is configured for broadcast email.",
      "requiredEnv": [
        "SENDGRID_API_KEY"
      ],
      "validator": "requiredEnv",
      "warningDescription": "Email feature is enabled, but SENDGRID_API_KEY is not configured."
    },
    {
      "description": "Push feature is enabled and uses Firebase Admin Messaging.",
      "feature": "push",
      "href": "/admin/sendNotification",
      "id": "push-broadcast",
      "label": "Push broadcast",
      "validator": "adminAccess"
    },
    {
      "description": "Users collection is reachable for campaign segment previews.",
      "href": "/admin/campaigns",
      "id": "campaign-segments",
      "label": "Campaign segments",
      "readyDescription": "Users collection is reachable for campaign segment previews.",
      "validator": "campaignSegments",
      "warningDescription": "Users collection was not reachable for campaign segment previews."
    },
    {
      "description": "Campaign planner is available for launch and lifecycle messaging.",
      "href": "/admin/campaigns",
      "id": "campaign-planner",
      "label": "Campaign planner",
      "readyDescription": "Campaign planner is available.",
      "validator": "campaignSegments",
      "warningDescription": "Campaign planner could not read users for segment previews."
    },
    {
      "description": "Bulk media uploads are available for launch assets.",
      "feature": "uploads",
      "href": "/admin/media-library",
      "id": "media-library",
      "label": "Media library",
      "readyDescription": "Media library can reach Firebase Storage.",
      "validator": "storage",
      "warningDescription": "Media library cannot reach Firebase Storage yet."
    },
    {
      "description": "Support and legal launch settings are complete.",
      "href": "/admin/settings",
      "id": "app-settings",
      "label": "App settings",
      "readyDescription": "Support and legal launch settings are complete.",
      "validator": "appSettings",
      "warningDescription": "Add support email, Terms URL and Privacy URL before production operations."
    },
    {
      "description": "Users collection is reachable for support search and quick actions.",
      "href": "/admin/support",
      "id": "support-cockpit",
      "label": "Support cockpit",
      "readyDescription": "Users collection is reachable for support search and quick actions.",
      "validator": "supportCockpit",
      "warningDescription": "Users collection was not reachable for support workflows."
    },
    {
      "description": "At least one writeable business collection already has content.",
      "id": "starter-content",
      "label": "Starter content",
      "readyDescription": "At least one writeable business collection already has content.",
      "validator": "starterContent",
      "warningDescription": "No starter content was found in writeable business collections."
    }
  ],
  "rolePermissions": {
    "content_manager": [
      "dashboard.read",
      "entities.read",
      "entities.write",
      "campaigns.read",
      "campaigns.write",
      "email.write",
      "notifications.write",
      "settings.read",
      "media.read",
      "media.write"
    ],
    "moderator": [
      "dashboard.read",
      "entities.read",
      "messaging.read",
      "moderation.read",
      "moderation.write",
      "support.read"
    ],
    "operator": [
      "audit.read",
      "campaigns.read",
      "campaigns.write",
      "dashboard.read",
      "email.write",
      "entities.read",
      "entities.write",
      "launch.read",
      "messaging.read",
      "messaging.write",
      "moderation.read",
      "moderation.write",
      "notifications.write",
      "operations.read",
      "operations.write",
      "media.read",
      "media.write",
      "settings.read",
      "settings.write",
      "support.read",
      "support.write"
    ],
    "owner": [
      "*"
    ],
    "support": [
      "dashboard.read",
      "entities.read",
      "media.read",
      "messaging.read",
      "support.read",
      "support.write"
    ]
  },
  "segments": [
    {
      "description": "All registered users.",
      "id": "all",
      "label": "All Users",
      "rule": {
        "type": "allUsers"
      }
    },
    {
      "description": "Users created in the last 30 days.",
      "id": "new_users",
      "label": "New Users",
      "rule": {
        "days": 30,
        "type": "newUsers"
      }
    },
    {
      "description": "Users without recent activity signals.",
      "id": "inactive_users",
      "label": "Inactive Users",
      "rule": {
        "days": 30,
        "type": "inactiveUsers"
      }
    },
    {
      "description": "Users with customer role.",
      "id": "customers",
      "label": "Customers",
      "rule": {
        "fieldExistsAny": [
          "customerID",
          "clientID"
        ],
        "roles": [
          "customer",
          "client"
        ],
        "type": "roleAny"
      }
    },
    {
      "description": "Service providers and professionals.",
      "id": "providers",
      "label": "Providers",
      "rule": {
        "fieldExistsAny": [
          "providerID",
          "professionalID",
          "professionalVendorID"
        ],
        "roles": [
          "provider",
          "professional"
        ],
        "type": "roleAny"
      }
    },
    {
      "description": "Vendors, stores or restaurants.",
      "id": "vendors",
      "label": "Vendors",
      "rule": {
        "fieldExistsAny": [
          "vendorID",
          "restaurantID",
          "storeID"
        ],
        "roles": [
          "vendor",
          "restaurant",
          "store"
        ],
        "type": "roleAny"
      }
    },
    {
      "description": "Drivers and delivery operators.",
      "id": "drivers",
      "label": "Drivers",
      "rule": {
        "fieldExistsAny": [
          "driverID",
          "courierID"
        ],
        "roles": [
          "driver",
          "courier"
        ],
        "type": "roleAny"
      }
    },
    {
      "description": "Creators and content-heavy users.",
      "id": "creators",
      "label": "Creators",
      "rule": {
        "fieldExistsAny": [
          "creatorID",
          "influencerID"
        ],
        "roles": [
          "creator",
          "influencer"
        ],
        "type": "roleAny"
      }
    }
  ],
  "settings": [
    {
      "group": "brand",
      "key": "appName",
      "label": "App Name",
      "type": "string"
    },
    {
      "group": "brand",
      "key": "brandName",
      "label": "Brand Name",
      "type": "string"
    },
    {
      "group": "brand",
      "key": "logoUrl",
      "label": "Logo URL",
      "type": "url"
    },
    {
      "group": "brand",
      "key": "primaryColor",
      "label": "Primary Color",
      "type": "color"
    },
    {
      "group": "support",
      "key": "supportEmail",
      "label": "Support Email",
      "required": true,
      "type": "email"
    },
    {
      "group": "support",
      "key": "supportPhone",
      "label": "Support Phone",
      "type": "phone"
    },
    {
      "group": "support",
      "key": "supportUrl",
      "label": "Support URL",
      "type": "url"
    },
    {
      "group": "legal",
      "key": "termsUrl",
      "label": "Terms URL",
      "required": true,
      "type": "url"
    },
    {
      "group": "legal",
      "key": "privacyUrl",
      "label": "Privacy URL",
      "required": true,
      "type": "url"
    },
    {
      "group": "feature_flags",
      "key": "maintenanceMode",
      "label": "Maintenance Mode",
      "type": "boolean"
    },
    {
      "group": "feature_flags",
      "key": "requireApproval",
      "label": "Require Content Approval",
      "type": "boolean"
    },
    {
      "group": "feature_flags",
      "key": "enablePayments",
      "label": "Enable Payments",
      "type": "boolean"
    },
    {
      "group": "remote_config",
      "key": "remoteConfigVersion",
      "label": "Remote Config Version",
      "type": "string"
    },
    {
      "group": "remote_config",
      "key": "minimumAppVersion",
      "label": "Minimum App Version",
      "type": "string"
    }
  ],
  "workflows": [
    {
      "actions": [
        "users_activate"
      ],
      "description": "Control availability for users.",
      "entity": "users",
      "id": "users_lifecycle",
      "label": "Lifecycle"
    },
    {
      "actions": [
        "users_feature"
      ],
      "description": "Promote important users.",
      "entity": "users",
      "id": "users_merchandising",
      "label": "Merchandising"
    },
    {
      "actions": [
        "users_reset_badge",
        "users_disable_account",
        "users_enable_account"
      ],
      "description": "Handle account support actions through protected server logic.",
      "entity": "users",
      "id": "users_support_workflow",
      "label": "Support Workflow"
    },
    {
      "actions": [
        "channels_mark_reviewed",
        "channels_mark_escalated",
        "channels_clear_escalation",
        "channels_support_handoff",
        "channels_clear_support_handoff"
      ],
      "description": "Review and escalate messaging resources.",
      "entity": "channels",
      "id": "channels_messaging_workflow",
      "label": "Messaging Workflow"
    },
    {
      "actions": [
        "listings_approve"
      ],
      "description": "Review and moderate listings.",
      "entity": "listings",
      "id": "listings_moderation",
      "label": "Moderation"
    },
    {
      "actions": [
        "listings_feature"
      ],
      "description": "Promote important listings.",
      "entity": "listings",
      "id": "listings_merchandising",
      "label": "Merchandising"
    },
    {
      "actions": [
        "listings_approve_listing",
        "listings_hide_listing",
        "listings_feature_listing",
        "listings_unfeature_listing",
        "listings_promote_listing",
        "listings_unpromote_listing",
        "listings_recalculate_rating",
        "listings_clear_saved"
      ],
      "description": "Review listing quality and maintenance tasks.",
      "entity": "listings",
      "id": "listings_listing_workflow",
      "label": "Listing Workflow"
    }
  ]
}

export function getEntityConfig(key: string): AdminEntityConfig {
  const entity = adminPanelConfig.entities.find(item => item.key === key)

  if (!entity) {
    throw new Error(`Unknown admin entity: ${key}`)
  }

  return entity
}
