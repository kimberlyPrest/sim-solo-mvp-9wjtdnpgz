# SIM Solo MVP - Technical Handoff Document

This document provides a comprehensive technical overview of the SIM Solo MVP, detailing its architecture, database structures, key workflows, and instructions for setup and deployment.

## 1. Tech Stack

- **Frontend Framework**: React 19, Vite, TypeScript
- **Styling**: Tailwind CSS, Shadcn UI
- **Routing**: React Router DOM v7
- **Database & Backend**: Supabase (PostgreSQL with PostGIS extension)
- **Edge Functions**: Deno (Supabase Edge Functions)
- **Mapping & Geospatial**: `shpjs`, `@turf/turf`, `proj4`, Leaflet (via `react-leaflet`)

## 2. Project Structure

- `src/components/`: Reusable UI components. `src/components/ui/` contains Shadcn UI primitives.
- `src/hooks/`: Custom React hooks, including `use-auth.tsx` for Supabase authentication and organization state.
- `src/lib/supabase/`: Supabase client initialization (`client.ts`) and auto-generated TypeScript types (`types.ts`).
- `src/pages/`: Application pages organized by domain (e.g., `dashboard`, `producers`, `farms`, `areas`, `imports`).
- `src/features/`: Feature-specific logic and complex components like the import wizards (`areas`, `soil`).
- `supabase/functions/`: Supabase Edge Functions. Contains `parse-shapefile` and `soil-analysis-excel`.
- `supabase/migrations/`: SQL migration files defining the database schema, RLS policies, and triggers.

## 3. Database & Security

The project uses Supabase PostgreSQL with PostGIS enabled for geographic features.
Data is organized hierarchically: `organizations` -> `producers` -> `farms` -> `areas` -> `area_seasons` -> `sampling_campaigns` -> `sampling_points` -> `samples` -> `lab_measurements`.

### Access Control (Row Level Security)

- **Authentication**: Users must be authenticated via Supabase Auth.
- **Organization Boundary**: All operational tables contain an `organization_id`. Users can only access data belonging to organizations they are members of (checked via the `organization_members` table).
- **Roles**:
  - `admin`: Full read/write access and user management.
  - `technician`: Full read/write access to operational data.
  - `viewer`: Read-only access. Write operations (INSERT, UPDATE, DELETE) are blocked at the RLS level and UI buttons are hidden based on this role.

## 4. Key Workflows

### Geographic Import (ZIP Shapefile)

1. User uploads a `.zip` file containing `.shp`, `.shx`, and `.dbf` files in the `GeographicImportWizard`.
2. The UI sends the file to Supabase Storage and triggers the `parse-shapefile` Edge Function.
3. The Edge Function extracts polygons (boundary) and points (sampling spots), projects them to EPSG:4326 if necessary, and returns a preview.
4. User validates the preview. On confirmation, the RPC `commit_geographic_import` is called to atomically save the boundary to the `areas` table and points to the `sampling_points` table.

### Lab Analysis Import (Excel)

1. User uploads an `.xlsx` file containing soil analysis results in the `ImportSoilWizard`.
2. The UI uploads the file to Supabase Storage and invokes the `soil-analysis-excel` Edge Function.
3. The Edge Function parses the Excel file, mapping the `PONTO` column to existing sampling points in the selected campaign.
4. On confirmation, the RPC `commit_soil_analysis_import` is called to save the data into `samples` and `lab_measurements`.

## 5. Limitations & Future Roadmap

- **Agronomic Interpretation**: Automatic interpretation of soil analysis (e.g., determining if Phosphorus is Low/Medium/High based on regional tables) is **NOT** implemented in this MVP.
- **Automated Dosaging**: Recommendation algorithms for fertilizer calculation are **NOT** included. Currently, recommendations are manually recorded via text fields and items.
- **Large Shapefiles**: Very large geographic files (>20MB) may timeout the Edge Function. Consider processing them in smaller batches or increasing the function timeout.

## 6. Execution & Deployment

### Local Development

1. Clone the repository and install dependencies: `npm install`.
2. Create a `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Start the Vite server: `npm run dev`.

### Database Migrations

To push the database schema to a linked Supabase project:

```bash
npx supabase db push
```

Ensure that the Supabase CLI is authenticated (`npx supabase login`) and linked to your project (`npx supabase link --project-ref <ref>`).

## 7. QA Checklist

Before considering a deployment stable, verify:

- [ ] Users with the `viewer` role cannot see "Edit/Add/Delete" buttons on any list or detail page.
- [ ] Uploading a ZIP file without a valid `.shp` throws a graceful error.
- [ ] Uploading a valid ZIP file correctly plots the area boundary and internal points on the map preview.
- [ ] Submitting an Excel file correctly links rows to points based on the `PONTO` column.
- [ ] The Dashboard statistics reflect real-time counts from the database.
- [ ] All "Loading..." states show properly while data is being fetched.
- [ ] No `null` or `undefined` labels appear when an entity has missing optional data (e.g., missing producer phone number shows `-`).
