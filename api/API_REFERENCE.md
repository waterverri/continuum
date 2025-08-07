# Continuum API Reference

## Authentication

All API endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

The token is validated against Supabase authentication and enforced by Row Level Security (RLS) policies.

## Base URL

```
Production: https://your-cloud-run-service.run.app
Development: http://localhost:8080
```

---

## Tags API

### Get Project Tags

**GET** `/api/tags/{projectId}`

Retrieve all tags for a specific project.

**Parameters:**
- `projectId` (string, required): The project ID

**Response:**
```json
{
  "tags": [
    {
      "id": "uuid",
      "project_id": "uuid", 
      "name": "Character",
      "color": "#6366f1",
      "created_at": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `500` - Internal server error

---

### Create Tag

**POST** `/api/tags/{projectId}`

Create a new tag for a project.

**Parameters:**
- `projectId` (string, required): The project ID

**Request Body:**
```json
{
  "name": "Character",
  "color": "#6366f1"
}
```

**Fields:**
- `name` (string, required): Tag name (unique within project, max 50 chars)
- `color` (string, optional): Hex color code (default: #6366f1)

**Response:**
```json
{
  "tag": {
    "id": "uuid",
    "project_id": "uuid",
    "name": "Character", 
    "color": "#6366f1",
    "created_at": "2023-01-01T00:00:00.000Z"
  }
}
```

**Status Codes:**
- `201` - Created successfully
- `400` - Invalid request (missing name, invalid color format)
- `409` - Tag name already exists in project
- `401` - Unauthorized
- `500` - Internal server error

---

### Update Tag

**PUT** `/api/tags/{projectId}/{tagId}`

Update an existing tag.

**Parameters:**
- `projectId` (string, required): The project ID
- `tagId` (string, required): The tag ID

**Request Body:**
```json
{
  "name": "Updated Name",
  "color": "#8b5cf6"
}
```

**Fields:**
- `name` (string, optional): New tag name
- `color` (string, optional): New hex color code

**Response:**
```json
{
  "tag": {
    "id": "uuid",
    "project_id": "uuid",
    "name": "Updated Name",
    "color": "#8b5cf6", 
    "created_at": "2023-01-01T00:00:00.000Z"
  }
}
```

**Status Codes:**
- `200` - Updated successfully
- `400` - Invalid request
- `404` - Tag not found
- `409` - Tag name already exists in project
- `401` - Unauthorized
- `500` - Internal server error

---

### Delete Tag

**DELETE** `/api/tags/{projectId}/{tagId}`

Delete a tag and all its associations.

**Parameters:**
- `projectId` (string, required): The project ID
- `tagId` (string, required): The tag ID

**Response:** Empty body

**Status Codes:**
- `204` - Deleted successfully
- `401` - Unauthorized  
- `500` - Internal server error

---

## Document-Tag Associations

### Get Document Tags

**GET** `/api/tags/{projectId}/documents/{documentId}`

Get all tags associated with a document.

**Parameters:**
- `projectId` (string, required): The project ID
- `documentId` (string, required): The document ID

**Response:**
```json
{
  "tags": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "name": "Character",
      "color": "#6366f1",
      "created_at": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `500` - Internal server error

---

### Add Tags to Document

**POST** `/api/tags/{projectId}/documents/{documentId}`

Associate multiple tags with a document.

**Parameters:**
- `projectId` (string, required): The project ID
- `documentId` (string, required): The document ID

**Request Body:**
```json
{
  "tagIds": ["tag-uuid-1", "tag-uuid-2"]
}
```

**Fields:**
- `tagIds` (array, required): Array of tag IDs to associate

**Response:**
```json
{
  "message": "Added 2 tag(s) to document",
  "associations": [
    {
      "document_id": "uuid",
      "tag_id": "uuid", 
      "created_at": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

**Status Codes:**
- `201` - Tags added successfully
- `400` - Invalid request (empty array, invalid tag IDs)
- `404` - Document not found
- `409` - All tags already associated
- `401` - Unauthorized
- `500` - Internal server error

---

### Remove Tag from Document

**DELETE** `/api/tags/{projectId}/documents/{documentId}/{tagId}`

Remove a specific tag from a document.

**Parameters:**
- `projectId` (string, required): The project ID  
- `documentId` (string, required): The document ID
- `tagId` (string, required): The tag ID to remove

**Response:** Empty body

**Status Codes:**
- `204` - Tag removed successfully
- `404` - Document or tag not found
- `401` - Unauthorized
- `500` - Internal server error

---

## Documents API

### Get Documents

**GET** `/api/documents/{projectId}`

Retrieve all documents for a project.

**Parameters:**
- `projectId` (string, required): The project ID

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "title": "Character Profile",
      "content": "Document content...",
      "document_type": "character",
      "is_composite": false,
      "created_at": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get Document

**GET** `/api/documents/{projectId}/{documentId}`

Retrieve a specific document, with optional composite resolution.

**Parameters:**
- `projectId` (string, required): The project ID
- `documentId` (string, required): The document ID
- `resolve` (query, optional): Set to "true" to resolve composite documents

**Response:**
```json
{
  "document": {
    "id": "uuid",
    "project_id": "uuid", 
    "title": "Character Profile",
    "content": "Document content...",
    "document_type": "character",
    "is_composite": false,
    "created_at": "2023-01-01T00:00:00.000Z",
    "resolved_content": "Resolved content if composite and resolve=true"
  }
}
```

---

### Create Document

**POST** `/api/documents/{projectId}`

Create a new document.

**Parameters:**
- `projectId` (string, required): The project ID

**Request Body:**
```json
{
  "title": "New Document",
  "content": "Document content...",
  "document_type": "character",
  "is_composite": false,
  "components": {},
  "group_id": "optional-group-uuid"
}
```

---

### Update Document

**PUT** `/api/documents/{projectId}/{documentId}`

Update an existing document.

**Parameters:**
- `projectId` (string, required): The project ID
- `documentId` (string, required): The document ID

**Request Body:** Same as create document

---

### Delete Document

**DELETE** `/api/documents/{projectId}/{documentId}`

Delete a document.

**Parameters:**
- `projectId` (string, required): The project ID
- `documentId` (string, required): The document ID

**Status Codes:**
- `204` - Deleted successfully

---

## Error Responses

All endpoints may return these error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common Error Status Codes:**
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## Rate Limiting

Currently no rate limiting is implemented, but this may be added in future versions.

## Versioning

The API is currently unversioned. Breaking changes will be communicated via the project repository.