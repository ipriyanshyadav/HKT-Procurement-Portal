export interface paths {
    "/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Metrics
         * @description Endpoint that serves Prometheus metrics.
         */
        get: operations["metrics_metrics_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health Check */
        get: operations["health_check_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health Ready */
        get: operations["health_ready_health_ready_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health Live */
        get: operations["health_live_health_live_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_organizations_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/business-units": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Business Units
         * @description List business units for the current user's organization.
         */
        get: operations["list_business_units_api_v1_organizations_business_units_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/business-units": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Business Units
         * @description List business units for the current user's organization.
         */
        get: operations["list_business_units_api_v1_business_units_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/organizations/cost-centers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Cost Centers
         * @description List cost centers for the current user's organization, optionally filtered by business unit.
         */
        get: operations["list_cost_centers_api_v1_organizations_cost_centers_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cost-centers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Cost Centers
         * @description List cost centers for the current user's organization, optionally filtered by business unit.
         */
        get: operations["list_cost_centers_api_v1_cost_centers_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Me
         * @description GET /api/v1/users/me — returns current user profile.
         */
        get: operations["get_me_api_v1_users_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get My Permissions
         * @description GET /api/v1/users/me/permissions — returns user's permission codes.
         */
        get: operations["get_my_permissions_api_v1_users_me_permissions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Change My Password
         * @description PUT /api/v1/users/me/password — change own password.
         */
        put: operations["change_my_password_api_v1_users_me_password_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Users
         * @description GET /api/v1/users — list users (requires user.view_all permission).
         */
        get: operations["list_users_api_v1_users__get"];
        put?: never;
        /**
         * Create User
         * @description POST /api/v1/users — create a new user.
         */
        post: operations["create_user_api_v1_users__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Roles
         * @description GET /api/v1/users/roles — list available roles in the organization.
         */
        get: operations["list_roles_api_v1_users_roles_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{user_id}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Assign User Role
         * @description POST /api/v1/users/{user_id}/roles — assign a role to user.
         */
        post: operations["assign_user_role_api_v1_users__user_id__roles_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{user_id}/roles/{role_code}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Remove User Role
         * @description DELETE /api/v1/users/{user_id}/roles/{role_code} — remove role from user.
         */
        delete: operations["remove_user_role_api_v1_users__user_id__roles__role_code__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{user_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get User
         * @description GET /api/v1/users/{id}.
         */
        get: operations["get_user_api_v1_users__user_id__get"];
        /**
         * Update User
         * @description PUT /api/v1/users/{id}.
         */
        put: operations["update_user_api_v1_users__user_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{user_id}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Activate User
         * @description POST /api/v1/users/{id}/activate.
         */
        post: operations["activate_user_api_v1_users__user_id__activate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{user_id}/deactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Deactivate User
         * @description POST /api/v1/users/{id}/deactivate.
         */
        post: operations["deactivate_user_api_v1_users__user_id__deactivate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Categories
         * @description List categories (flat or tree view). Accessible by all authenticated users and during registration.
         */
        get: operations["list_categories_api_v1_master_data_categories_get"];
        put?: never;
        /**
         * Create Category
         * @description Create a new category (5-level maximum enforced).
         */
        post: operations["create_category_api_v1_master_data_categories_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/categories/tree": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Category Tree
         * @description Get full category hierarchy tree or subtree via recursive CTE. Accessible by all authenticated users and during registration.
         */
        get: operations["get_category_tree_api_v1_master_data_categories_tree_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update Category
         * @description Update an existing category.
         */
        put: operations["update_category_api_v1_master_data_categories__id__put"];
        post?: never;
        /**
         * Delete Category
         * @description Soft delete a category (fails if active sub-categories exist).
         */
        delete: operations["delete_category_api_v1_master_data_categories__id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/uoms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Uoms
         * @description List units of measure.
         */
        get: operations["list_uoms_api_v1_master_data_uoms_get"];
        put?: never;
        /**
         * Create Uom
         * @description Create a new unit of measure.
         */
        post: operations["create_uom_api_v1_master_data_uoms_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/uom": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Uoms
         * @description List units of measure.
         */
        get: operations["list_uoms_api_v1_master_data_uom_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/uoms/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update Uom
         * @description Update an existing unit of measure.
         */
        put: operations["update_uom_api_v1_master_data_uoms__id__put"];
        post?: never;
        /**
         * Delete Uom
         * @description Soft delete a unit of measure.
         */
        delete: operations["delete_uom_api_v1_master_data_uoms__id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/currencies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Currencies
         * @description List currencies with optional live Redis-cached exchange rates.
         */
        get: operations["list_currencies_api_v1_master_data_currencies_get"];
        put?: never;
        /**
         * Create Currency
         * @description Create a new currency.
         */
        post: operations["create_currency_api_v1_master_data_currencies_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/currencies/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update Currency
         * @description Update an existing currency.
         */
        put: operations["update_currency_api_v1_master_data_currencies__id__put"];
        post?: never;
        /**
         * Delete Currency
         * @description Soft delete a currency.
         */
        delete: operations["delete_currency_api_v1_master_data_currencies__id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/payment-terms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Payment Terms
         * @description List payment terms.
         */
        get: operations["list_payment_terms_api_v1_master_data_payment_terms_get"];
        put?: never;
        /**
         * Create Payment Term
         * @description Create a new payment term.
         */
        post: operations["create_payment_term_api_v1_master_data_payment_terms_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/payment-terms/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update Payment Term
         * @description Update an existing payment term.
         */
        put: operations["update_payment_term_api_v1_master_data_payment_terms__id__put"];
        post?: never;
        /**
         * Delete Payment Term
         * @description Soft delete a payment term.
         */
        delete: operations["delete_payment_term_api_v1_master_data_payment_terms__id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/incoterms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Incoterms
         * @description List Incoterms 2020 standard codes.
         */
        get: operations["list_incoterms_api_v1_master_data_incoterms_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/tax-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Tax Codes
         * @description List tax codes.
         */
        get: operations["list_tax_codes_api_v1_master_data_tax_codes_get"];
        put?: never;
        /**
         * Create Tax Code
         * @description Create a new tax code.
         */
        post: operations["create_tax_code_api_v1_master_data_tax_codes_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/tax-codes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update Tax Code
         * @description Update an existing tax code.
         */
        put: operations["update_tax_code_api_v1_master_data_tax_codes__id__put"];
        post?: never;
        /**
         * Delete Tax Code
         * @description Soft delete a tax code.
         */
        delete: operations["delete_tax_code_api_v1_master_data_tax_codes__id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/delivery-locations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Delivery Locations
         * @description List delivery locations.
         */
        get: operations["list_delivery_locations_api_v1_master_data_delivery_locations_get"];
        put?: never;
        /**
         * Create Delivery Location
         * @description Create a delivery location.
         */
        post: operations["create_delivery_location_api_v1_master_data_delivery_locations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/delivery-locations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update Delivery Location
         * @description Update an existing delivery location.
         */
        put: operations["update_delivery_location_api_v1_master_data_delivery_locations__id__put"];
        post?: never;
        /**
         * Delete Delivery Location
         * @description Soft delete (deactivate) a delivery location.
         */
        delete: operations["delete_delivery_location_api_v1_master_data_delivery_locations__id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/holidays/{year}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Holidays By Year
         * @description List holidays for a specific calendar year.
         */
        get: operations["list_holidays_by_year_api_v1_master_data_holidays__year__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/holidays": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Holiday
         * @description Add a custom holiday.
         */
        post: operations["create_holiday_api_v1_master_data_holidays_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/holidays/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete Holiday
         * @description Soft delete a holiday.
         */
        delete: operations["delete_holiday_api_v1_master_data_holidays__id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/import/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Import Categories
         * @description Bulk import categories from CSV (async via Celery, max 5000 rows).
         */
        post: operations["import_categories_api_v1_master_data_import_categories_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/import/categories/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Import Status
         * @description Check the status of a category import job.
         */
        get: operations["get_import_status_api_v1_master_data_import_categories__job_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/master-data/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_master_data_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/invitation/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Validate Invitation Token
         * @description Validate invitation token and return pre-filled vendor data.
         */
        get: operations["validate_invitation_token_api_v1_vendors_invitation__token__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/register/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register Vendor With Token
         * @description Complete vendor registration wizard step via invitation token.
         */
        post: operations["register_vendor_with_token_api_v1_vendors_register__token__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/invite": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Invite Vendor
         * @description Buyer invites a vendor by company name and email.
         */
        post: operations["invite_vendor_api_v1_vendors_invite_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Vendors
         * @description List vendors with pagination, filtering, and search.
         */
        get: operations["list_vendors_api_v1_vendors_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/export/csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Vendors Csv
         * @description Stream CSV export of vendors.
         */
        get: operations["export_vendors_csv_api_v1_vendors_export_csv_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/export/pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Vendors Pdf
         * @description Stream PDF export of vendors.
         */
        get: operations["export_vendors_pdf_api_v1_vendors_export_pdf_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/check-duplicates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Check Duplicates
         * @description Run duplicate detection checks.
         */
        post: operations["check_duplicates_api_v1_vendors_check_duplicates_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/bulk-category-mapping": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Bulk Category Mapping
         * @description Bulk map categories to multiple vendors via imported CSV / JSON entries.
         */
        post: operations["bulk_category_mapping_api_v1_vendors_bulk_category_mapping_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get My Vendor Profile
         * @description Supplier portal endpoint to fetch the current supplier's own vendor details.
         */
        get: operations["get_my_vendor_profile_api_v1_vendors_me_get"];
        /**
         * Update My Vendor Profile
         * @description Supplier portal endpoint to update the current supplier's own vendor details.
         */
        put: operations["update_my_vendor_profile_api_v1_vendors_me_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/me/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get My Vendor Documents
         * @description Supplier portal endpoint to list documents for current supplier.
         */
        get: operations["get_my_vendor_documents_api_v1_vendors_me_documents_get"];
        put?: never;
        /**
         * Add My Vendor Document
         * @description Supplier portal endpoint to attach a document for current supplier.
         */
        post: operations["add_my_vendor_document_api_v1_vendors_me_documents_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Vendor Detail
         * @description Get complete vendor details.
         */
        get: operations["get_vendor_detail_api_v1_vendors__id__get"];
        /**
         * Update Vendor
         * @description Update vendor profile.
         */
        put: operations["update_vendor_api_v1_vendors__id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit Vendor
         * @description Submit vendor registration for review.
         */
        post: operations["submit_vendor_api_v1_vendors__id__submit_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/qualify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Qualify Vendor
         * @description Mark vendor as qualified.
         */
        post: operations["qualify_vendor_api_v1_vendors__id__qualify_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Activate Vendor
         * @description Activate a qualified vendor and assign vendor code.
         */
        post: operations["activate_vendor_api_v1_vendors__id__activate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reject Vendor
         * @description Reject vendor qualification.
         */
        post: operations["reject_vendor_api_v1_vendors__id__reject_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/request-resubmission": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Request Resubmission
         * @description Request resubmission of vendor documents or information.
         */
        post: operations["request_resubmission_api_v1_vendors__id__request_resubmission_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/suspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Suspend Vendor
         * @description Suspend an active vendor.
         */
        post: operations["suspend_vendor_api_v1_vendors__id__suspend_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/reinstate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reinstate Vendor
         * @description Reinstate a suspended vendor.
         */
        post: operations["reinstate_vendor_api_v1_vendors__id__reinstate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/initiate-blacklist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Initiate Blacklist
         * @description Initiate dual-approval blacklisting for a vendor.
         */
        post: operations["initiate_blacklist_api_v1_vendors__id__initiate_blacklist_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/confirm-blacklist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm Blacklist
         * @description Confirm vendor blacklisting (enforces Segregation of Duties).
         */
        post: operations["confirm_blacklist_api_v1_vendors__id__confirm_blacklist_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/scorecard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Vendor Scorecard
         * @description Get the latest vendor scorecard.
         */
        get: operations["get_vendor_scorecard_api_v1_vendors__id__scorecard_get"];
        put?: never;
        /**
         * Update Vendor Scorecard
         * @description Recalculate or update vendor scorecard.
         */
        post: operations["update_vendor_scorecard_api_v1_vendors__id__scorecard_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Vendor Documents
         * @description List documents for a vendor.
         */
        get: operations["get_vendor_documents_api_v1_vendors__id__documents_get"];
        put?: never;
        /**
         * Add Vendor Document
         * @description Attach a document to vendor profile.
         */
        post: operations["add_vendor_document_api_v1_vendors__id__documents_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Update Vendor Categories
         * @description Update category mappings for a vendor.
         */
        post: operations["update_vendor_categories_api_v1_vendors__id__categories_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/bank-accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add Bank Account
         * @description Add a bank account to vendor profile.
         */
        post: operations["add_bank_account_api_v1_vendors__id__bank_accounts_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/bank-accounts/{bank_id}/initiate-penny-test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Initiate Penny Test
         * @description Initiate penny drop verification test.
         */
        post: operations["initiate_penny_test_api_v1_vendors__id__bank_accounts__bank_id__initiate_penny_test_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/vendors/{id}/bank-accounts/{bank_id}/confirm-penny-test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm Penny Test
         * @description Confirm penny test by entering amount received.
         */
        post: operations["confirm_penny_test_api_v1_vendors__id__bank_accounts__bank_id__confirm_penny_test_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Requisitions */
        get: operations["list_requisitions_api_v1_requisitions_get"];
        put?: never;
        /** Create Requisition */
        post: operations["create_requisition_api_v1_requisitions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Bulk Create Requisitions
         * @description POST /api/v1/requisitions/bulk — create multiple requisitions in batch.
         */
        post: operations["bulk_create_requisitions_api_v1_requisitions_bulk_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/export/csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Requisitions Csv
         * @description Stream CSV export of requisitions.
         */
        get: operations["export_requisitions_csv_api_v1_requisitions_export_csv_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/export/pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Requisitions Pdf
         * @description Stream PDF export of requisitions.
         */
        get: operations["export_requisitions_pdf_api_v1_requisitions_export_pdf_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Requisition */
        get: operations["get_requisition_api_v1_requisitions__id__get"];
        /** Update Requisition */
        put: operations["update_requisition_api_v1_requisitions__id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/{id}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit Requisition */
        post: operations["submit_requisition_api_v1_requisitions__id__submit_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/{id}/withdraw": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Withdraw Requisition */
        post: operations["withdraw_requisition_api_v1_requisitions__id__withdraw_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/{id}/amend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Amend Requisition */
        post: operations["amend_requisition_api_v1_requisitions__id__amend_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/merge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Merge Requisitions */
        post: operations["merge_requisitions_api_v1_requisitions_merge_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/{id}/split": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Split Requisition */
        post: operations["split_requisition_api_v1_requisitions__id__split_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/{id}/convert-to-rfq": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Convert To Rfq */
        post: operations["convert_to_rfq_api_v1_requisitions__id__convert_to_rfq_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/{id}/convert-to-po": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Convert To Po */
        post: operations["convert_to_po_api_v1_requisitions__id__convert_to_po_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/{id}/audit-trail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Pr Audit Trail */
        get: operations["get_pr_audit_trail_api_v1_requisitions__id__audit_trail_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/{id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve Requisition */
        post: operations["approve_requisition_api_v1_requisitions__id__approve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/requisitions/{id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reject Requisition */
        post: operations["reject_requisition_api_v1_requisitions__id__reject_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/unmapped-prs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Unmapped Prs */
        get: operations["list_unmapped_prs_api_v1_unmapped_prs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/unmapped-prs/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Unmapped Pr Dashboard */
        get: operations["get_unmapped_pr_dashboard_api_v1_unmapped_prs_dashboard_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/unmapped-prs/{id}/map": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Map Unmapped Pr */
        post: operations["map_unmapped_pr_api_v1_unmapped_prs__id__map_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/unmapped-prs/{id}/suggest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Mapping Suggestions */
        get: operations["get_mapping_suggestions_api_v1_unmapped_prs__id__suggest_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/unmapped-prs/{id}/auto-map": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Auto Map Pr */
        post: operations["auto_map_pr_api_v1_unmapped_prs__id__auto_map_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Rfqs */
        get: operations["list_rfqs_api_v1_rfqs_get"];
        put?: never;
        /** Create Rfq */
        post: operations["create_rfq_api_v1_rfqs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/export/csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Rfqs Csv
         * @description Stream CSV export of RFQs.
         */
        get: operations["export_rfqs_csv_api_v1_rfqs_export_csv_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/export/pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Rfqs Pdf
         * @description Stream PDF export of RFQs.
         */
        get: operations["export_rfqs_pdf_api_v1_rfqs_export_pdf_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Rfq */
        get: operations["get_rfq_api_v1_rfqs__id__get"];
        /** Update Rfq */
        put: operations["update_rfq_api_v1_rfqs__id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit Rfq */
        post: operations["submit_rfq_api_v1_rfqs__id__submit_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish Rfq */
        post: operations["publish_rfq_api_v1_rfqs__id__publish_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/amend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Amend Rfq */
        post: operations["amend_rfq_api_v1_rfqs__id__amend_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel Rfq */
        post: operations["cancel_rfq_api_v1_rfqs__id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/extend-deadline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Extend Deadline */
        post: operations["extend_deadline_api_v1_rfqs__id__extend_deadline_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/add-participants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add Participants */
        post: operations["add_participants_api_v1_rfqs__id__add_participants_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/participants/{vendor_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove Participant */
        delete: operations["remove_participant_api_v1_rfqs__id__participants__vendor_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/initiate-bid-opening": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Initiate Bid Opening
         * @description Step 1 of dual-authorization bid opening.
         *     Initiator must NOT be the RFQ creator.
         */
        post: operations["initiate_bid_opening_api_v1_rfqs__id__initiate_bid_opening_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/co-authorize-opening": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Co Authorize Bid Opening
         * @description Step 2 of dual-authorization bid opening.
         *     Co-authorizer must be a different user than the initiator.
         */
        post: operations["co_authorize_bid_opening_api_v1_rfqs__id__co_authorize_opening_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/clarifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Clarifications */
        get: operations["get_clarifications_api_v1_rfqs__id__clarifications_get"];
        put?: never;
        /** Add Clarification */
        post: operations["add_clarification_api_v1_rfqs__id__clarifications_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/clarifications/{cid}/respond": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Respond To Clarification */
        put: operations["respond_to_clarification_api_v1_rfqs__id__clarifications__cid__respond_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/audit-trail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Rfq Audit Trail */
        get: operations["get_rfq_audit_trail_api_v1_rfqs__id__audit_trail_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{id}/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Rfq Dashboard */
        get: operations["get_rfq_dashboard_api_v1_rfqs__id__dashboard_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Rfqs */
        get: operations["list_rfqs_api_v1_sourcing_get"];
        put?: never;
        /** Create Rfq */
        post: operations["create_rfq_api_v1_sourcing_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/export/csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Rfqs Csv
         * @description Stream CSV export of RFQs.
         */
        get: operations["export_rfqs_csv_api_v1_sourcing_export_csv_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/export/pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Rfqs Pdf
         * @description Stream PDF export of RFQs.
         */
        get: operations["export_rfqs_pdf_api_v1_sourcing_export_pdf_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Rfq */
        get: operations["get_rfq_api_v1_sourcing__id__get"];
        /** Update Rfq */
        put: operations["update_rfq_api_v1_sourcing__id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit Rfq */
        post: operations["submit_rfq_api_v1_sourcing__id__submit_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish Rfq */
        post: operations["publish_rfq_api_v1_sourcing__id__publish_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/amend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Amend Rfq */
        post: operations["amend_rfq_api_v1_sourcing__id__amend_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel Rfq */
        post: operations["cancel_rfq_api_v1_sourcing__id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/extend-deadline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Extend Deadline */
        post: operations["extend_deadline_api_v1_sourcing__id__extend_deadline_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/add-participants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add Participants */
        post: operations["add_participants_api_v1_sourcing__id__add_participants_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/participants/{vendor_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove Participant */
        delete: operations["remove_participant_api_v1_sourcing__id__participants__vendor_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/initiate-bid-opening": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Initiate Bid Opening
         * @description Step 1 of dual-authorization bid opening.
         *     Initiator must NOT be the RFQ creator.
         */
        post: operations["initiate_bid_opening_api_v1_sourcing__id__initiate_bid_opening_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/co-authorize-opening": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Co Authorize Bid Opening
         * @description Step 2 of dual-authorization bid opening.
         *     Co-authorizer must be a different user than the initiator.
         */
        post: operations["co_authorize_bid_opening_api_v1_sourcing__id__co_authorize_opening_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/clarifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Clarifications */
        get: operations["get_clarifications_api_v1_sourcing__id__clarifications_get"];
        put?: never;
        /** Add Clarification */
        post: operations["add_clarification_api_v1_sourcing__id__clarifications_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/clarifications/{cid}/respond": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Respond To Clarification */
        put: operations["respond_to_clarification_api_v1_sourcing__id__clarifications__cid__respond_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/audit-trail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Rfq Audit Trail */
        get: operations["get_rfq_audit_trail_api_v1_sourcing__id__audit_trail_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sourcing/{id}/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Rfq Dashboard */
        get: operations["get_rfq_dashboard_api_v1_sourcing__id__dashboard_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{rfq_id}/bid-count": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Bid Count
         * @description Returns only the count of submitted bids.
         *     NEVER returns bid content before bids are officially opened.
         */
        get: operations["get_bid_count_api_v1_rfqs__rfq_id__bid_count_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{rfq_id}/bids": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Revise Bid */
        put: operations["revise_bid_api_v1_rfqs__rfq_id__bids_put"];
        /** Submit Bid */
        post: operations["submit_bid_api_v1_rfqs__rfq_id__bids_post"];
        /** Withdraw Bid */
        delete: operations["withdraw_bid_api_v1_rfqs__rfq_id__bids_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/bids/{bid_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Bid Details
         * @description Returns bid details. Prices are masked until RFQ.bids_opened_at IS NOT NULL.
         *     Vendors can only see their own bids before opening.
         */
        get: operations["get_bid_details_api_v1_bids__bid_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{rfq_id}/single-vendor-check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Single Vendor Check */
        get: operations["single_vendor_check_api_v1_rfqs__rfq_id__single_vendor_check_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_evaluations_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/rfq/{rfq_id}/generate-cs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Generate Comparative Statement */
        post: operations["generate_comparative_statement_api_v1_evaluations_rfq__rfq_id__generate_cs_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/rfq/{rfq_id}/cs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Latest Cs For Rfq */
        get: operations["get_latest_cs_for_rfq_api_v1_evaluations_rfq__rfq_id__cs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/rfq/{rfq_id}/cs-versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Cs Versions */
        get: operations["list_cs_versions_api_v1_evaluations_rfq__rfq_id__cs_versions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/{cs_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Cs By Id */
        get: operations["get_cs_by_id_api_v1_evaluations__cs_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/{cs_id}/shortlist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Shortlist Vendors */
        post: operations["shortlist_vendors_api_v1_evaluations__cs_id__shortlist_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/{cs_id}/negotiations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Negotiations For Cs */
        get: operations["get_negotiations_for_cs_api_v1_evaluations__cs_id__negotiations_get"];
        put?: never;
        /** Start Negotiation */
        post: operations["start_negotiation_api_v1_evaluations__cs_id__negotiations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/negotiations/{negotiation_id}/submit-price": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit Negotiated Price */
        post: operations["submit_negotiated_price_api_v1_evaluations_negotiations__negotiation_id__submit_price_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/{cs_id}/recommend-award": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Recommend Award */
        post: operations["recommend_award_api_v1_evaluations__cs_id__recommend_award_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/{cs_id}/award": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Award Recommendation */
        get: operations["get_award_recommendation_api_v1_evaluations__cs_id__award_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/awards/{arn_id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve Award */
        post: operations["approve_award_api_v1_evaluations_awards__arn_id__approve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/evaluations/{cs_id}/send-regret-letters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Send Regret Letters */
        post: operations["send_regret_letters_api_v1_evaluations__cs_id__send_regret_letters_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/awards/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_awards_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_contracts_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Contracts
         * @description List contracts with filters and pagination.
         */
        get: operations["list_contracts_api_v1_contracts_get"];
        put?: never;
        /**
         * Create Contract
         * @description Create a new contract manually.
         */
        post: operations["create_contract_api_v1_contracts_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts/from-award/{arn_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Contract From Award
         * @description Create contract from an approved award recommendation (S13-04).
         */
        post: operations["create_contract_from_award_api_v1_contracts_from_award__arn_id__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts/templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Templates
         * @description List available contract templates.
         */
        get: operations["list_templates_api_v1_contracts_templates_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts/{contract_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Contract Detail
         * @description Get single contract details including lines, milestones, amendments, countdown.
         */
        get: operations["get_contract_detail_api_v1_contracts__contract_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts/{contract_id}/esign/initiate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Initiate Esign
         * @description Initiate eSignature workflow via Digio (primary) or DocuSign (fallback).
         */
        post: operations["initiate_esign_api_v1_contracts__contract_id__esign_initiate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts/{contract_id}/esign/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm Esign
         * @description Confirm signature completion and activate contract.
         */
        post: operations["confirm_esign_api_v1_contracts__contract_id__esign_confirm_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts/esign/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Esign Webhook
         * @description Receive eSign webhook events from Digio / DocuSign.
         */
        post: operations["esign_webhook_api_v1_contracts_esign_callback_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts/{contract_id}/amend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Amend Contract
         * @description Create a formal versioned amendment with before/after snapshot (S13-07).
         */
        post: operations["amend_contract_api_v1_contracts__contract_id__amend_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts/{contract_id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update Contract Status
         * @description Transition contract status validated against FSM rules.
         */
        put: operations["update_contract_status_api_v1_contracts__contract_id__status_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts/{contract_id}/milestones/{milestone_id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Complete Milestone
         * @description Mark a contract milestone as completed.
         */
        post: operations["complete_milestone_api_v1_contracts__contract_id__milestones__milestone_id__complete_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/contracts/{contract_id}/utilization": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Update Utilization
         * @description Update utilized value for RATE_CONTRACT with optimistic locking check (S13-17).
         */
        post: operations["update_utilization_api_v1_contracts__contract_id__utilization_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_purchase_orders_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Purchase Orders */
        get: operations["list_purchase_orders_api_v1_purchase_orders_get"];
        put?: never;
        /** Create Purchase Order */
        post: operations["create_purchase_order_api_v1_purchase_orders_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders/from-award": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create From Award */
        post: operations["create_from_award_api_v1_purchase_orders_from_award_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders/{po_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Purchase Order */
        get: operations["get_purchase_order_api_v1_purchase_orders__po_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders/{po_id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve Purchase Order */
        post: operations["approve_purchase_order_api_v1_purchase_orders__po_id__approve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders/{po_id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reject Purchase Order */
        post: operations["reject_purchase_order_api_v1_purchase_orders__po_id__reject_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders/{po_id}/send-to-vendor": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Send To Vendor */
        post: operations["send_to_vendor_api_v1_purchase_orders__po_id__send_to_vendor_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders/{po_id}/acknowledge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Acknowledge Purchase Order */
        post: operations["acknowledge_purchase_order_api_v1_purchase_orders__po_id__acknowledge_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders/{po_id}/amend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Amend Purchase Order */
        post: operations["amend_purchase_order_api_v1_purchase_orders__po_id__amend_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders/{po_id}/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Close Purchase Order */
        post: operations["close_purchase_order_api_v1_purchase_orders__po_id__close_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders/{po_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel Purchase Order */
        post: operations["cancel_purchase_order_api_v1_purchase_orders__po_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/purchase-orders/{po_id}/pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download Po Pdf */
        get: operations["download_po_pdf_api_v1_purchase_orders__po_id__pdf_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/grn/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_grn_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/grn": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Grns */
        get: operations["list_grns_api_v1_grn_get"];
        put?: never;
        /** Create Grn */
        post: operations["create_grn_api_v1_grn_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/grn/{grn_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Grn */
        get: operations["get_grn_api_v1_grn__grn_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/grn/inspections": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record Quality Inspection */
        post: operations["record_quality_inspection_api_v1_grn_inspections_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/grn/{grn_id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Confirm Grn */
        post: operations["confirm_grn_api_v1_grn__grn_id__confirm_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/grn/{grn_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel Grn */
        post: operations["cancel_grn_api_v1_grn__grn_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invoices/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_invoices_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invoices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Invoices */
        get: operations["list_invoices_api_v1_invoices_get"];
        put?: never;
        /** Submit Invoice */
        post: operations["submit_invoice_api_v1_invoices_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invoices/export/csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Invoices Csv
         * @description Stream CSV export of invoices.
         */
        get: operations["export_invoices_csv_api_v1_invoices_export_csv_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invoices/export/pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export Invoices Pdf
         * @description Stream PDF export of invoices.
         */
        get: operations["export_invoices_pdf_api_v1_invoices_export_pdf_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invoices/eligible-lines": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Eligible Lines */
        get: operations["get_eligible_lines_api_v1_invoices_eligible_lines_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invoices/{invoice_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Invoice */
        get: operations["get_invoice_api_v1_invoices__invoice_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invoices/{invoice_id}/match": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Match Invoice */
        post: operations["match_invoice_api_v1_invoices__invoice_id__match_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invoices/{invoice_id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve Invoice */
        post: operations["approve_invoice_api_v1_invoices__invoice_id__approve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invoices/{invoice_id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reject Invoice */
        post: operations["reject_invoice_api_v1_invoices__invoice_id__reject_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invoices/{invoice_id}/dispute": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Dispute Invoice */
        post: operations["dispute_invoice_api_v1_invoices__invoice_id__dispute_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_payments_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Payments */
        get: operations["list_payments_api_v1_payments_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/schedule": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Schedule Payment */
        post: operations["schedule_payment_api_v1_payments_schedule_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/{payment_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Payment */
        get: operations["get_payment_api_v1_payments__payment_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/{payment_id}/remittance-pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download Remittance Pdf
         * @description Download official payment remittance advice as a generated PDF.
         */
        get: operations["download_remittance_pdf_api_v1_payments__payment_id__remittance_pdf_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/{payment_id}/process": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Process Payment */
        post: operations["process_payment_api_v1_payments__payment_id__process_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/webhook": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Erp Payment Webhook
         * @description Inbound webhook from external ERP system recording payment settlement.
         */
        post: operations["erp_payment_webhook_api_v1_payments_webhook_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/disputes/all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Disputes */
        get: operations["list_disputes_api_v1_payments_disputes_all_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/disputes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create Dispute */
        post: operations["create_dispute_api_v1_payments_disputes_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/disputes/{dispute_id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add Dispute Message */
        post: operations["add_dispute_message_api_v1_payments_disputes__dispute_id__messages_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/disputes/{dispute_id}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Resolve Dispute */
        post: operations["resolve_dispute_api_v1_payments_disputes__dispute_id__resolve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get notifications for current user
         * @description Retrieve paginated notifications for current user, ordered unread first.
         */
        get: operations["get_notifications_api_v1_notifications_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/{notification_id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark single notification as read
         * @description Mark a specific notification as read.
         */
        post: operations["mark_notification_read_api_v1_notifications__notification_id__read_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/mark-all-read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark all notifications as read
         * @description Mark all unread notifications for current user as read.
         */
        post: operations["mark_all_notifications_read_api_v1_notifications_mark_all_read_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get user notification preferences
         * @description Retrieve notification channel preferences for current user.
         */
        get: operations["get_notification_preferences_api_v1_notifications_preferences_get"];
        /**
         * Update user notification preferences
         * @description Update notification preferences for current user.
         */
        put: operations["update_notification_preferences_api_v1_notifications_preferences_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_documents_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Upload Document
         * @description Upload and virus-scan a document attachment, storing in MinIO.
         */
        post: operations["upload_document_api_v1_documents_upload_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/presigned-url": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Document Presigned Url
         * @description Generate a 15-minute presigned download URL for a document.
         */
        get: operations["get_document_presigned_url_api_v1_documents__id__presigned_url_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Document Versions
         * @description Retrieve version history for a document.
         */
        get: operations["get_document_versions_api_v1_documents__id__versions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete Document
         * @description Soft delete a document.
         */
        delete: operations["delete_document_api_v1_documents__id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/entity/{entity_type}/{entity_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Entity Documents
         * @description List active documents associated with a specific entity (e.g. Vendor, PO, Invoice).
         */
        get: operations["list_entity_documents_api_v1_documents_entity__entity_type___entity_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/instances/{instance_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Instance
         * @description Get a workflow instance by ID.
         */
        get: operations["get_instance_api_v1_workflows_instances__instance_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/tasks/my": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get My Tasks
         * @description Get pending workflow tasks assigned to the current user.
         */
        get: operations["get_my_tasks_api_v1_workflows_tasks_my_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/instances/{instance_id}/tasks/{task_id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Approve Task
         * @description Approve a workflow task.
         */
        post: operations["approve_task_api_v1_workflows_instances__instance_id__tasks__task_id__approve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/instances/{instance_id}/tasks/{task_id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reject Task
         * @description Reject a workflow task (fails the workflow instance).
         */
        post: operations["reject_task_api_v1_workflows_instances__instance_id__tasks__task_id__reject_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/instances/{instance_id}/tasks/{task_id}/return": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Return Task
         * @description Return a workflow task for revision.
         */
        post: operations["return_task_api_v1_workflows_instances__instance_id__tasks__task_id__return_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/instances/{instance_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel Instance
         * @description Cancel a workflow instance.
         */
        post: operations["cancel_instance_api_v1_workflows_instances__instance_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/instances/{instance_id}/pause": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Pause Instance
         * @description Pause a workflow instance (admin action).
         */
        post: operations["pause_instance_api_v1_workflows_instances__instance_id__pause_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/instances/{instance_id}/resume": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resume Instance
         * @description Resume a paused workflow instance (admin action).
         */
        post: operations["resume_instance_api_v1_workflows_instances__instance_id__resume_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/instances/{instance_id}/force-advance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Force Advance
         * @description Force-advance a workflow to the next step (admin only, creates compliance log).
         */
        post: operations["force_advance_api_v1_workflows_instances__instance_id__force_advance_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/simulate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Simulate
         * @description Simulate the approval chain for a template + context.
         *     Read-only — zero DB writes guaranteed.
         */
        post: operations["simulate_api_v1_workflows_simulate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Templates
         * @description GET /api/v1/workflows/templates — list all workflow templates for the organization.
         */
        get: operations["list_templates_api_v1_workflows_templates_get"];
        put?: never;
        /**
         * Create Template
         * @description POST /api/v1/workflows/templates — author a new workflow template.
         */
        post: operations["create_template_api_v1_workflows_templates_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workflows/templates/{template_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Template Detail
         * @description GET /api/v1/workflows/templates/{id} — get detailed template configuration.
         */
        get: operations["get_template_detail_api_v1_workflows_templates__template_id__get"];
        /**
         * Update Template
         * @description PUT /api/v1/workflows/templates/{id} — update template configuration.
         */
        put: operations["update_template_api_v1_workflows_templates__template_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/approval-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Rules
         * @description List approval rules by entity_type (optional filter).
         */
        get: operations["list_rules_api_v1_approval_rules_get"];
        put?: never;
        /**
         * Create Rule
         * @description Create an approval rule (PROCUREMENT_ADMIN only).
         */
        post: operations["create_rule_api_v1_approval_rules_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/approval-rules/{rule_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Rule
         * @description Get single approval rule detail.
         */
        get: operations["get_rule_api_v1_approval_rules__rule_id__get"];
        /**
         * Update Rule
         * @description Update an approval rule (must be inactive to update).
         */
        put: operations["update_rule_api_v1_approval_rules__rule_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/approval-rules/{rule_id}/activate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Activate Rule
         * @description Activate a rule (PROCUREMENT_ADMIN only). Checks priority conflicts first.
         */
        post: operations["activate_rule_api_v1_approval_rules__rule_id__activate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/approval-rules/{rule_id}/deactivate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Deactivate Rule
         * @description Deactivate a rule. Does NOT create a version snapshot.
         */
        post: operations["deactivate_rule_api_v1_approval_rules__rule_id__deactivate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/approval-rules/{rule_id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Rule Versions
         * @description Get version history for an approval rule.
         */
        get: operations["get_rule_versions_api_v1_approval_rules__rule_id__versions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/approval-rules/simulate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Simulate Rule Matching
         * @description Dry-run rule matching — ZERO DB writes.
         *     Returns which rule would match and the resulting workflow template.
         */
        post: operations["simulate_rule_matching_api_v1_approval_rules_simulate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Integration Stats
         * @description Retrieve aggregate statistics for external ERP and sync integration jobs.
         */
        get: operations["get_integration_stats_api_v1_integrations_stats_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Integration Jobs
         * @description List integration jobs with filtering and pagination.
         */
        get: operations["list_integration_jobs_api_v1_integrations_jobs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/jobs/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Integration Job Detail
         * @description Get single integration job detail including request and response payloads.
         */
        get: operations["get_integration_job_detail_api_v1_integrations_jobs__job_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/jobs/{job_id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retry Integration Job
         * @description Manually trigger a retry for a failed or stalled integration job.
         */
        post: operations["retry_integration_job_api_v1_integrations_jobs__job_id__retry_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/scheduled-runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Scheduled Runs
         * @description List recent scheduled cron and background integration job executions.
         */
        get: operations["list_scheduled_runs_api_v1_integrations_scheduled_runs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/sync/trigger": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Trigger Erp Sync
         * @description Manually trigger an outbound/bidirectional ERP synchronization run.
         */
        post: operations["trigger_erp_sync_api_v1_integrations_sync_trigger_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/integrations/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Integration Config
         * @description Retrieve current ERP adapter configuration and allowed integration domains for SSRF prevention.
         */
        get: operations["get_integration_config_api_v1_integrations_config_get"];
        /**
         * Update Integration Config
         * @description Update active ERP provider settings and allowed outbound domains.
         */
        put: operations["update_integration_config_api_v1_integrations_config_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_analytics_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Dashboard */
        get: operations["get_dashboard_api_v1_analytics_dashboard_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/spend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Spend */
        get: operations["get_spend_api_v1_analytics_spend_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/savings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Savings */
        get: operations["get_savings_api_v1_analytics_savings_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/cycle-times": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Cycle Times */
        get: operations["get_cycle_times_api_v1_analytics_cycle_times_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/vendor-performance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get All Vendor Performance */
        get: operations["get_all_vendor_performance_api_v1_analytics_vendor_performance_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/vendor-performance/{vendor_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Single Vendor Performance */
        get: operations["get_single_vendor_performance_api_v1_analytics_vendor_performance__vendor_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/sla-compliance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Sla Compliance */
        get: operations["get_sla_compliance_api_v1_analytics_sla_compliance_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/compliance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Compliance */
        get: operations["get_compliance_api_v1_analytics_compliance_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/unmapped-prs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Unmapped Prs */
        get: operations["get_unmapped_prs_api_v1_analytics_unmapped_prs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/invoices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Invoices */
        get: operations["get_invoices_api_v1_analytics_invoices_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/export/csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Export Csv
         * @description Stream CSV export for analytics report.
         */
        get: operations["get_export_csv_api_v1_analytics_export_csv_get"];
        put?: never;
        /** Export Csv */
        post: operations["export_csv_api_v1_analytics_export_csv_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/export/pdf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Export Pdf
         * @description Stream PDF export for analytics report.
         */
        get: operations["get_export_pdf_api_v1_analytics_export_pdf_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/analytics/export/excel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Export Excel */
        post: operations["export_excel_api_v1_analytics_export_excel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_admin_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/audit-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Audit Logs
         * @description Elasticsearch-backed audit log search with date range, entity type, action, actor filters.
         */
        get: operations["get_audit_logs_api_v1_admin_audit_logs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Login
         * @description POST /api/v1/auth/login — password login. Returns access_token; sets portal-scoped refresh_token cookie.
         */
        post: operations["login_api_v1_auth_login_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Refresh
         * @description POST /api/v1/auth/refresh — reads refresh_token from portal-scoped httpOnly cookie.
         */
        post: operations["refresh_api_v1_auth_refresh_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Logout
         * @description POST /api/v1/auth/logout — revokes session and clears portal-scoped refresh_token cookie.
         */
        post: operations["logout_api_v1_auth_logout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/mfa/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify Mfa
         * @description POST /api/v1/auth/mfa/verify — exchanges mfa_token + TOTP code for access token.
         */
        post: operations["verify_mfa_api_v1_auth_mfa_verify_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/mfa/enroll": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Enroll Mfa
         * @description POST /api/v1/auth/mfa/enroll — returns TOTP URI for QR code. Not enabled until /mfa/confirm.
         */
        post: operations["enroll_mfa_api_v1_auth_mfa_enroll_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/mfa/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm Mfa
         * @description POST /api/v1/auth/mfa/confirm — verifies TOTP code and enables MFA.
         */
        post: operations["confirm_mfa_api_v1_auth_mfa_confirm_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/sso/initiate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Sso Initiate
         * @description GET /api/v1/auth/sso/initiate — SAML or OIDC redirect initiation.
         */
        get: operations["sso_initiate_api_v1_auth_sso_initiate_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/sso/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sso Callback
         * @description POST /api/v1/auth/sso/callback — SAML 2.0 ACS URL handler.
         */
        post: operations["sso_callback_api_v1_auth_sso_callback_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/sso/oidc/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Oidc Callback
         * @description GET /api/v1/auth/sso/oidc/callback — OIDC authorization code exchange.
         */
        get: operations["oidc_callback_api_v1_auth_sso_oidc_callback_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{rfq_id}/auction/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Auction State
         * @description GET /api/v1/rfqs/{rfq_id}/auction/state — get live reverse auction room state.
         */
        get: operations["get_auction_state_api_v1_rfqs__rfq_id__auction_state_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/rfqs/{rfq_id}/auction/bid": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Place Auction Bid
         * @description POST /api/v1/rfqs/{rfq_id}/auction/bid — place counter-bid in reverse auction.
         */
        post: operations["place_auction_bid_api_v1_rfqs__rfq_id__auction_bid_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Auctions */
        get: operations["list_auctions_api_v1_auctions_get"];
        put?: never;
        /** Create Auction */
        post: operations["create_auction_api_v1_auctions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{auction_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Auction */
        get: operations["get_auction_api_v1_auctions__auction_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{auction_id}/open": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Open Auction */
        post: operations["open_auction_api_v1_auctions__auction_id__open_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{auction_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel Auction */
        post: operations["cancel_auction_api_v1_auctions__auction_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{auction_id}/release-results": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Release Results */
        post: operations["release_results_api_v1_auctions__auction_id__release_results_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{auction_id}/leaderboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Leaderboard
         * @description Buyer-only: full leaderboard with prices and vendor names.
         */
        get: operations["get_leaderboard_api_v1_auctions__auction_id__leaderboard_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{auction_id}/my-rank": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get My Rank
         * @description Vendor-only: own rank + L1 price (subject to rank_visibility config).
         */
        get: operations["get_my_rank_api_v1_auctions__auction_id__my_rank_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{auction_id}/bids": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Bid History */
        get: operations["get_bid_history_api_v1_auctions__auction_id__bids_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{auction_id}/proxy-floor": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Set Proxy Floor */
        post: operations["set_proxy_floor_api_v1_auctions__auction_id__proxy_floor_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** APIResponse[AwardRecommendationResponse] */
        APIResponse_AwardRecommendationResponse_: {
            data: components["schemas"]["AwardRecommendationResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[BidCountResponse] */
        APIResponse_BidCountResponse_: {
            data: components["schemas"]["BidCountResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[BidDetailResponse] */
        APIResponse_BidDetailResponse_: {
            data: components["schemas"]["BidDetailResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[ComparativeStatementResponse] */
        APIResponse_ComparativeStatementResponse_: {
            data: components["schemas"]["ComparativeStatementResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[ContractMilestoneResponse] */
        APIResponse_ContractMilestoneResponse_: {
            data: components["schemas"]["ContractMilestoneResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[ContractResponse] */
        APIResponse_ContractResponse_: {
            data: components["schemas"]["ContractResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[DisputeMessageResponse] */
        APIResponse_DisputeMessageResponse_: {
            data: components["schemas"]["DisputeMessageResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[DisputeResponse] */
        APIResponse_DisputeResponse_: {
            data: components["schemas"]["DisputeResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[ERPConfigResponse] */
        APIResponse_ERPConfigResponse_: {
            data: components["schemas"]["ERPConfigResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[EsignInitiateResponse] */
        APIResponse_EsignInitiateResponse_: {
            data: components["schemas"]["EsignInitiateResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[GrnResponse] */
        APIResponse_GrnResponse_: {
            data: components["schemas"]["GrnResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[IntegrationJobResponse] */
        APIResponse_IntegrationJobResponse_: {
            data: components["schemas"]["IntegrationJobResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[IntegrationStatsResponse] */
        APIResponse_IntegrationStatsResponse_: {
            data: components["schemas"]["IntegrationStatsResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[InvoiceResponse] */
        APIResponse_InvoiceResponse_: {
            data: components["schemas"]["InvoiceResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[BusinessUnitResponse]] */
        APIResponse_List_BusinessUnitResponse__: {
            /** Data */
            data: components["schemas"]["BusinessUnitResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[CSVersionSummaryResponse]] */
        APIResponse_List_CSVersionSummaryResponse__: {
            /** Data */
            data: components["schemas"]["CSVersionSummaryResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[ContractListResponse]] */
        APIResponse_List_ContractListResponse__: {
            /** Data */
            data: components["schemas"]["ContractListResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[ContractTemplateResponse]] */
        APIResponse_List_ContractTemplateResponse__: {
            /** Data */
            data: components["schemas"]["ContractTemplateResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[CostCenterResponse]] */
        APIResponse_List_CostCenterResponse__: {
            /** Data */
            data: components["schemas"]["CostCenterResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[DisputeResponse]] */
        APIResponse_List_DisputeResponse__: {
            /** Data */
            data: components["schemas"]["DisputeResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[EligibleLineResponse]] */
        APIResponse_List_EligibleLineResponse__: {
            /** Data */
            data: components["schemas"]["EligibleLineResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[GrnResponse]] */
        APIResponse_List_GrnResponse__: {
            /** Data */
            data: components["schemas"]["GrnResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[IntegrationJobResponse]] */
        APIResponse_List_IntegrationJobResponse__: {
            /** Data */
            data: components["schemas"]["IntegrationJobResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[InvoiceResponse]] */
        APIResponse_List_InvoiceResponse__: {
            /** Data */
            data: components["schemas"]["InvoiceResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[NegotiationResponse]] */
        APIResponse_List_NegotiationResponse__: {
            /** Data */
            data: components["schemas"]["NegotiationResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[POResponse]] */
        APIResponse_List_POResponse__: {
            /** Data */
            data: components["schemas"]["POResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[PRDetailResponse]] */
        APIResponse_List_PRDetailResponse__: {
            /** Data */
            data: components["schemas"]["PRDetailResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[PRListResponse]] */
        APIResponse_List_PRListResponse__: {
            /** Data */
            data: components["schemas"]["PRListResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[PaymentRecordResponse]] */
        APIResponse_List_PaymentRecordResponse__: {
            /** Data */
            data: components["schemas"]["PaymentRecordResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[RfqClarificationResponse]] */
        APIResponse_List_RfqClarificationResponse__: {
            /** Data */
            data: components["schemas"]["RfqClarificationResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[RfqListResponse]] */
        APIResponse_List_RfqListResponse__: {
            /** Data */
            data: components["schemas"]["RfqListResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[RfqParticipantResponse]] */
        APIResponse_List_RfqParticipantResponse__: {
            /** Data */
            data: components["schemas"]["RfqParticipantResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[ScheduledJobRunResponse]] */
        APIResponse_List_ScheduledJobRunResponse__: {
            /** Data */
            data: components["schemas"]["ScheduledJobRunResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[UnmappedPRExceptionResponse]] */
        APIResponse_List_UnmappedPRExceptionResponse__: {
            /** Data */
            data: components["schemas"]["UnmappedPRExceptionResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[List[dict]] */
        APIResponse_List_dict__: {
            /** Data */
            data: {
                [key: string]: unknown;
            }[];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[LiveAuctionDetailResponse] */
        APIResponse_LiveAuctionDetailResponse_: {
            data: components["schemas"]["LiveAuctionDetailResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[NegotiationResponse] */
        APIResponse_NegotiationResponse_: {
            data: components["schemas"]["NegotiationResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[POResponse] */
        APIResponse_POResponse_: {
            data: components["schemas"]["POResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[PRDetailResponse] */
        APIResponse_PRDetailResponse_: {
            data: components["schemas"]["PRDetailResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[PaymentRecordResponse] */
        APIResponse_PaymentRecordResponse_: {
            data: components["schemas"]["PaymentRecordResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[QualityInspectionResponse] */
        APIResponse_QualityInspectionResponse_: {
            data: components["schemas"]["QualityInspectionResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[RegretLettersResponse] */
        APIResponse_RegretLettersResponse_: {
            data: components["schemas"]["RegretLettersResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[RfqClarificationResponse] */
        APIResponse_RfqClarificationResponse_: {
            data: components["schemas"]["RfqClarificationResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[RfqDashboardResponse] */
        APIResponse_RfqDashboardResponse_: {
            data: components["schemas"]["RfqDashboardResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[RfqDetailResponse] */
        APIResponse_RfqDetailResponse_: {
            data: components["schemas"]["RfqDetailResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[ShortlistResponse] */
        APIResponse_ShortlistResponse_: {
            data: components["schemas"]["ShortlistResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[SingleVendorCheckResponse] */
        APIResponse_SingleVendorCheckResponse_: {
            data: components["schemas"]["SingleVendorCheckResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[SyncTriggerResponse] */
        APIResponse_SyncTriggerResponse_: {
            data: components["schemas"]["SyncTriggerResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[UnmappedPRDashboardResponse] */
        APIResponse_UnmappedPRDashboardResponse_: {
            data: components["schemas"]["UnmappedPRDashboardResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[UnmappedPRSuggestionResponse] */
        APIResponse_UnmappedPRSuggestionResponse_: {
            data: components["schemas"]["UnmappedPRSuggestionResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[dict] */
        APIResponse_dict_: {
            /** Data */
            data: {
                [key: string]: unknown;
            };
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[list[LiveAuctionDetailResponse]] */
        APIResponse_list_LiveAuctionDetailResponse__: {
            /** Data */
            data: components["schemas"]["LiveAuctionDetailResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** APIResponse[list[dict]] */
        APIResponse_list_dict__: {
            /** Data */
            data: {
                [key: string]: unknown;
            }[];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             */
            timestamp?: string;
        };
        /** AddParticipantsRequest */
        AddParticipantsRequest: {
            /** Vendor Ids */
            vendor_ids: string[];
        };
        /** AmendRequest */
        AmendRequest: {
            /** Changes Summary */
            changes_summary: string;
            /** New Bid Close At */
            new_bid_close_at?: string | null;
            /** Field Changes */
            field_changes?: {
                [key: string]: unknown;
            };
        };
        /** ApprovalRuleCreateRequest */
        ApprovalRuleCreateRequest: {
            /**
             * Entity Type
             * @description One of: PR, RFQ, PO, VENDOR, CONTRACT
             */
            entity_type: string;
            /** Rule Code */
            rule_code: string;
            /** Rule Name */
            rule_name: string;
            /** Priority */
            priority: number;
            /** Conditions */
            conditions?: {
                [key: string]: unknown;
            };
            /** Condition Expression */
            condition_expression?: string | null;
            /** Workflow Template Code */
            workflow_template_code: string;
            /**
             * Is Catch All
             * @default false
             */
            is_catch_all: boolean;
            /** Effective From */
            effective_from?: string | null;
            /** Effective To */
            effective_to?: string | null;
        };
        /** ApprovalRuleSimulateRequest */
        ApprovalRuleSimulateRequest: {
            /** Entity Type */
            entity_type: string;
            /** Entity Context */
            entity_context?: {
                [key: string]: unknown;
            };
        };
        /** ApprovalRuleUpdateRequest */
        ApprovalRuleUpdateRequest: {
            /** Rule Name */
            rule_name?: string | null;
            /** Priority */
            priority?: number | null;
            /** Conditions */
            conditions?: {
                [key: string]: unknown;
            } | null;
            /** Condition Expression */
            condition_expression?: string | null;
            /** Workflow Template Code */
            workflow_template_code?: string | null;
            /** Effective To */
            effective_to?: string | null;
        };
        /** AssignRoleRequest */
        AssignRoleRequest: {
            /** Role Code */
            role_code: string;
        };
        /** AuctionBidRequest */
        AuctionBidRequest: {
            /** Amount */
            amount: number;
            /** Remarks */
            remarks?: string | null;
        };
        /**
         * AuctionConfig
         * @description Stored in rfq.auction_config JSONB column.
         */
        AuctionConfig: {
            /**
             * Auction Start At
             * Format: date-time
             */
            auction_start_at: string;
            /**
             * Auction Duration Minutes
             * @default 60
             */
            auction_duration_minutes: number;
            /** Lot Ids */
            lot_ids?: string[];
            /** Reserve Price Inr */
            reserve_price_inr?: number | string | null;
            /**
             * Min Decrement Type
             * @default PERCENTAGE
             * @enum {string}
             */
            min_decrement_type: "PERCENTAGE" | "ABSOLUTE";
            /**
             * Min Decrement Value
             * @default 0.5
             */
            min_decrement_value: number | string;
            /**
             * Rank Visibility
             * @default RANK_ONLY
             * @enum {string}
             */
            rank_visibility: "RANK_ONLY" | "PRICE_AND_RANK" | "NO_RANK";
            /**
             * Auto Extend
             * @default true
             */
            auto_extend: boolean;
            /**
             * Auto Extend Trigger Minutes
             * @default 5
             */
            auto_extend_trigger_minutes: number;
            /**
             * Auto Extend Duration Minutes
             * @default 10
             */
            auto_extend_duration_minutes: number;
            /**
             * Max Extensions
             * @default 3
             */
            max_extensions: number;
            /**
             * Allow Proxy Bid
             * @default false
             */
            allow_proxy_bid: boolean;
            /**
             * Require All Lots
             * @default true
             */
            require_all_lots: boolean;
        };
        /** AuctionCreateRequest */
        AuctionCreateRequest: {
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            config: components["schemas"]["AuctionConfig"];
        };
        /** AwardApprovalRequest */
        AwardApprovalRequest: {
            /** Task Id */
            task_id?: string | null;
            /** Comments */
            comments?: string | null;
        };
        /** AwardDetailResponse */
        AwardDetailResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Arn Id
             * Format: uuid
             */
            arn_id: string;
            /** Lot Id */
            lot_id?: string | null;
            /** Rfq Line Id */
            rfq_line_id?: string | null;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /**
             * Bid Id
             * Format: uuid
             */
            bid_id: string;
            /** Awarded Unit Price */
            awarded_unit_price: string;
            /** Awarded Quantity */
            awarded_quantity: string;
            /** Awarded Total */
            awarded_total: string;
            /** Award Type */
            award_type: string;
            /** Justification */
            justification?: string | null;
            /** Created At */
            created_at?: string | null;
        };
        /** AwardRecommendRequest */
        AwardRecommendRequest: {
            /** Awards */
            awards: components["schemas"]["AwardRecommendationItem"][];
            /**
             * Justification
             * @description Overall business case justification for award
             */
            justification: string;
        };
        /** AwardRecommendationItem */
        AwardRecommendationItem: {
            /** Lot Id */
            lot_id?: string | null;
            /** Rfq Line Id */
            rfq_line_id?: string | null;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /**
             * Bid Id
             * Format: uuid
             */
            bid_id: string;
            /**
             * Value
             * @description Total awarded value in INR
             */
            value: number | string;
            /**
             * Quantity
             * @default 1.0
             */
            quantity: number | string | null;
            /** Unit Price */
            unit_price?: number | string | null;
            /**
             * Award Type
             * @description FULL / SPLIT
             * @default FULL
             */
            award_type: string | null;
            /**
             * Justification
             * @description Award reason / L1 justification
             */
            justification: string;
        };
        /** AwardRecommendationResponse */
        AwardRecommendationResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /**
             * Cs Id
             * Format: uuid
             */
            cs_id: string;
            /** Arn Number */
            arn_number: string;
            /** Status */
            status: string;
            /** Justification */
            justification: string;
            /** Total Awarded Value */
            total_awarded_value?: string | null;
            /**
             * Recommended By
             * Format: uuid
             */
            recommended_by: string;
            /** Approved By */
            approved_by?: string | null;
            /** Approved At */
            approved_at?: string | null;
            /** Created At */
            created_at?: string | null;
            /**
             * Details
             * @default []
             */
            details: components["schemas"]["AwardDetailResponse"][];
        };
        /** BidCountResponse */
        BidCountResponse: {
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /** Bid Count */
            bid_count: number;
            /** Bids Opened */
            bids_opened: boolean;
            /** Bids Opened At */
            bids_opened_at?: string | null;
        };
        /** BidDetailResponse */
        BidDetailResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /** Status */
            status: string;
            /** Current Version */
            current_version: number;
            /** Submitted At */
            submitted_at?: string | null;
            /** Has Deviations */
            has_deviations: boolean;
            /** Deviation Details */
            deviation_details?: string | null;
            /** Technical Offer Compliant */
            technical_offer_compliant: boolean;
            /** Payment Terms Code */
            payment_terms_code?: string | null;
            /** Delivery Terms Incoterm */
            delivery_terms_incoterm?: string | null;
            /** Bid Validity Days */
            bid_validity_days: number;
            /** Covering Letter */
            covering_letter?: string | null;
            /** Is Single Vendor Situation */
            is_single_vendor_situation: boolean;
            /** Bid Opened At */
            bid_opened_at?: string | null;
            /** Is Technically Qualified */
            is_technically_qualified?: boolean | null;
            /** Technical Score */
            technical_score?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Lines */
            lines?: components["schemas"]["BidLineDetailResponse"][];
        };
        /** BidLineDetailResponse */
        BidLineDetailResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Bid Id
             * Format: uuid
             */
            bid_id: string;
            /**
             * Rfq Line Id
             * Format: uuid
             */
            rfq_line_id: string;
            /** Lot Id */
            lot_id?: string | null;
            /** Currency */
            currency: string;
            /** Quantity */
            quantity: string;
            /** Delivery Days */
            delivery_days: number;
            /** Unit Price */
            unit_price?: string | null;
            /** Total Price */
            total_price?: string | null;
            /** Normalized Price Inr */
            normalized_price_inr?: string | null;
            /** Exchange Rate Used */
            exchange_rate_used?: string | null;
            /** Tax Rate Declared */
            tax_rate_declared: string;
            /** Freight Quoted */
            freight_quoted: string;
            /** Country Of Origin */
            country_of_origin: string;
            /** Remarks */
            remarks?: string | null;
        };
        /** BidLineSubmitRequest */
        BidLineSubmitRequest: {
            /** Lot Id */
            lot_id?: string | null;
            /**
             * Rfq Line Id
             * Format: uuid
             */
            rfq_line_id: string;
            /** Unit Price */
            unit_price: number | string;
            /** Total Price */
            total_price: number | string;
            /**
             * Currency
             * @default INR
             */
            currency: string;
            /** Quantity */
            quantity: number | string;
            /** Delivery Days */
            delivery_days: number;
            /**
             * Tax Rate Declared
             * @default 0.0
             */
            tax_rate_declared: number | string;
            /**
             * Freight Quoted
             * @default 0.0
             */
            freight_quoted: number | string;
            /**
             * Country Of Origin
             * @default IN
             */
            country_of_origin: string;
            /** Remarks */
            remarks?: string | null;
        };
        /** BidReviseRequest */
        BidReviseRequest: {
            /** Has Deviations */
            has_deviations?: boolean | null;
            /** Deviation Details */
            deviation_details?: string | null;
            /** Technical Offer Compliant */
            technical_offer_compliant?: boolean | null;
            /** Payment Terms Code */
            payment_terms_code?: string | null;
            /** Delivery Terms Incoterm */
            delivery_terms_incoterm?: string | null;
            /** Bid Validity Days */
            bid_validity_days?: number | null;
            /** Covering Letter */
            covering_letter?: string | null;
            /** Lines */
            lines: components["schemas"]["BidLineSubmitRequest"][];
        };
        /** BidSubmitRequest */
        BidSubmitRequest: {
            /**
             * Has Deviations
             * @default false
             */
            has_deviations: boolean;
            /** Deviation Details */
            deviation_details?: string | null;
            /**
             * Technical Offer Compliant
             * @default true
             */
            technical_offer_compliant: boolean;
            /** Payment Terms Code */
            payment_terms_code?: string | null;
            /** Delivery Terms Incoterm */
            delivery_terms_incoterm?: string | null;
            /**
             * Bid Validity Days
             * @default 90
             */
            bid_validity_days: number;
            /** Covering Letter */
            covering_letter?: string | null;
            /** Lines */
            lines: components["schemas"]["BidLineSubmitRequest"][];
        };
        /** BidWithdrawRequest */
        BidWithdrawRequest: {
            /** Reason */
            reason: string;
        };
        /** Body_import_categories_api_v1_master_data_import_categories_post */
        Body_import_categories_api_v1_master_data_import_categories_post: {
            /** File */
            file: string;
        };
        /** Body_upload_document_api_v1_documents_upload_post */
        Body_upload_document_api_v1_documents_upload_post: {
            /** File */
            file: string;
            /** Entity Type */
            entity_type: string;
            /**
             * Entity Id
             * Format: uuid
             */
            entity_id: string;
            /** Document Type */
            document_type?: string | null;
            /** Category */
            category?: string | null;
            /** Compliance Expiry */
            compliance_expiry?: string | null;
        };
        /** BulkVendorCategoryMappingItem */
        BulkVendorCategoryMappingItem: {
            /** Vendor Id */
            vendor_id?: string | null;
            /** Vendor Code */
            vendor_code?: string | null;
            /** Category Ids */
            category_ids?: string[];
        };
        /** BulkVendorCategoryMappingRequest */
        BulkVendorCategoryMappingRequest: {
            /** Mappings */
            mappings: components["schemas"]["BulkVendorCategoryMappingItem"][];
        };
        /** BusinessUnitResponse */
        BusinessUnitResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Code */
            code: string;
            /** Name */
            name: string;
            /**
             * Legal Entity Id
             * Format: uuid
             */
            legal_entity_id: string;
            /** Erp Company Code */
            erp_company_code?: string | null;
            /**
             * Default Currency
             * @default INR
             */
            default_currency: string;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /** Created At */
            created_at?: string | null;
            /** Updated At */
            updated_at?: string | null;
        };
        /** CSGenerateRequest */
        CSGenerateRequest: {
            /**
             * Cost Of Capital Rate
             * @description Annual cost of capital (e.g. 0.12 for 12%)
             */
            cost_of_capital_rate?: number | string | null;
            /**
             * Evaluation Methodology
             * @description L1_PRICE_ONLY / QCBS / TECHNICAL_MERIT
             */
            evaluation_methodology?: string | null;
        };
        /** CSLineRankingResponse */
        CSLineRankingResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Cs Id
             * Format: uuid
             */
            cs_id: string;
            /** Lot Id */
            lot_id?: string | null;
            /** Rfq Line Id */
            rfq_line_id?: string | null;
            /**
             * Bid Id
             * Format: uuid
             */
            bid_id: string;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /** Raw Unit Price */
            raw_unit_price: string;
            /** Freight Per Unit */
            freight_per_unit: string;
            /** Tax Per Unit */
            tax_per_unit: string;
            /** Landed Cost */
            landed_cost: string;
            /** Npv Adjusted Cost */
            npv_adjusted_cost: string;
            /** Rank */
            rank: number;
            /** Tax Discrepancy */
            tax_discrepancy: boolean;
            /** Supplier Declared Rate */
            supplier_declared_rate?: string | null;
            /** Hsn Master Rate */
            hsn_master_rate?: string | null;
            /** Tie Breaking Applied */
            tie_breaking_applied: boolean;
            /** Tie Breaking Reason */
            tie_breaking_reason?: string | null;
            /** Lot Total Inr */
            lot_total_inr?: string | null;
            /** Technical Score */
            technical_score?: string | null;
            /** Commercial Score */
            commercial_score?: string | null;
            /** Composite Score */
            composite_score?: string | null;
            /** Is L1 */
            is_l1: boolean;
        };
        /** CSVersionSummaryResponse */
        CSVersionSummaryResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Cs Number */
            cs_number: string;
            /** Cs Version */
            cs_version: number;
            /** Status */
            status: string;
            /** L1 Total Value */
            l1_total_value?: string | null;
            /** Savings Percentage */
            savings_percentage?: string | null;
            /** Created At */
            created_at?: string | null;
            /**
             * Generated By
             * Format: uuid
             */
            generated_by: string;
        };
        /** CancelAuctionRequest */
        CancelAuctionRequest: {
            /** Reason */
            reason: string;
        };
        /** CategoryCreateRequest */
        CategoryCreateRequest: {
            /** Code */
            code: string;
            /** Name */
            name: string;
            /** Parent Id */
            parent_id?: string | null;
            /** Unspsc Code */
            unspsc_code?: string | null;
        };
        /** CategoryUpdateRequest */
        CategoryUpdateRequest: {
            /** Name */
            name?: string | null;
            /** Unspsc Code */
            unspsc_code?: string | null;
            /** Is Active */
            is_active?: boolean | null;
        };
        /** ChangePasswordRequest */
        ChangePasswordRequest: {
            /** Current Password */
            current_password: string;
            /** New Password */
            new_password: string;
        };
        /** ClarificationCreateRequest */
        ClarificationCreateRequest: {
            /** Question */
            question: string;
        };
        /** ClarificationRespondRequest */
        ClarificationRespondRequest: {
            /** Answer */
            answer: string;
            /**
             * Broadcast
             * @default true
             */
            broadcast: boolean;
        };
        /** ComparativeStatementResponse */
        ComparativeStatementResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /** Cs Number */
            cs_number: string;
            /** Status */
            status: string;
            /** Cost Of Capital Rate */
            cost_of_capital_rate: string;
            /** Evaluation Methodology */
            evaluation_methodology: string;
            /** Total Estimated Value */
            total_estimated_value: string;
            /** L1 Total Value */
            l1_total_value?: string | null;
            /** Savings Percentage */
            savings_percentage?: string | null;
            /** Recommendations */
            recommendations?: string | null;
            /**
             * Generated By
             * Format: uuid
             */
            generated_by: string;
            /** Approved By */
            approved_by?: string | null;
            /** Approved At */
            approved_at?: string | null;
            /** Pdf Document Id */
            pdf_document_id?: string | null;
            /** Document Path */
            document_path?: string | null;
            /** Cs Version */
            cs_version: number;
            /** Created At */
            created_at?: string | null;
            /**
             * Rankings
             * @default []
             */
            rankings: components["schemas"]["CSLineRankingResponse"][];
        };
        /** ContractAmendRequest */
        ContractAmendRequest: {
            /**
             * Amendment Type
             * @default VALUE_CHANGE
             */
            amendment_type: string;
            /** Change Description */
            change_description: string;
            /** New Total Value */
            new_total_value?: number | string | null;
            /** New End Date */
            new_end_date?: string | null;
            /** Field Changes */
            field_changes?: {
                [key: string]: unknown;
            } | null;
        };
        /** ContractAmendmentResponse */
        ContractAmendmentResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Contract Id
             * Format: uuid
             */
            contract_id: string;
            /** Amendment Number */
            amendment_number: number;
            /** Amendment Type */
            amendment_type: string;
            /** Changes Summary */
            changes_summary?: string | null;
            /** Change Description */
            change_description?: string | null;
            /** Field Changes */
            field_changes?: {
                [key: string]: unknown;
            } | null;
            /** Original Snapshot */
            original_snapshot?: {
                [key: string]: unknown;
            };
            /** New Document Id */
            new_document_id?: string | null;
            /**
             * Amended By
             * Format: uuid
             */
            amended_by: string;
            /** Approved By */
            approved_by?: string | null;
            /** Approved At */
            approved_at?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** ContractCreateRequest */
        ContractCreateRequest: {
            /** Title */
            title: string;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /**
             * Contract Type
             * @default RATE_CONTRACT
             */
            contract_type: string;
            /**
             * Currency
             * @default INR
             */
            currency: string;
            /** Total Value */
            total_value: number | string;
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
            /**
             * End Date
             * Format: date
             */
            end_date: string;
            /**
             * Business Unit Id
             * Format: uuid
             */
            business_unit_id: string;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /** Payment Term Id */
            payment_term_id?: string | null;
            /** Incoterm Id */
            incoterm_id?: string | null;
            /** Template Id */
            template_id?: string | null;
            /** Rfq Id */
            rfq_id?: string | null;
            /** Award Recommendation Id */
            award_recommendation_id?: string | null;
            /**
             * Auto Renew
             * @default false
             */
            auto_renew: boolean;
            /**
             * Renewal Notice Days
             * @default 30
             */
            renewal_notice_days: number;
            /** Sla Terms */
            sla_terms?: {
                [key: string]: unknown;
            } | null;
            /** Lines */
            lines?: components["schemas"]["ContractLineCreate"][];
            /** Milestones */
            milestones?: components["schemas"]["ContractMilestoneCreate"][] | null;
        };
        /** ContractFromAwardRequest */
        ContractFromAwardRequest: {
            /**
             * Award Recommendation Id
             * Format: uuid
             */
            award_recommendation_id: string;
            /** Title */
            title?: string | null;
            /** Start Date */
            start_date?: string | null;
            /** End Date */
            end_date?: string | null;
            /**
             * Auto Renew
             * @default false
             */
            auto_renew: boolean;
            /**
             * Renewal Notice Days
             * @default 30
             */
            renewal_notice_days: number;
            /** Sla Terms */
            sla_terms?: {
                [key: string]: unknown;
            } | null;
            /** Template Id */
            template_id?: string | null;
            /** Payment Term Id */
            payment_term_id?: string | null;
            /** Incoterm Id */
            incoterm_id?: string | null;
            /** Milestones */
            milestones?: components["schemas"]["ContractMilestoneCreate"][] | null;
        };
        /** ContractLineCreate */
        ContractLineCreate: {
            /** Line Number */
            line_number: number;
            /** Item Description */
            item_description: string;
            /**
             * Uom Id
             * Format: uuid
             */
            uom_id: string;
            /** Contracted Quantity */
            contracted_quantity?: number | string | null;
            /** Unit Rate */
            unit_rate: number | string;
            /** Hsn Code */
            hsn_code?: string | null;
        };
        /** ContractLineResponse */
        ContractLineResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Contract Id
             * Format: uuid
             */
            contract_id: string;
            /** Line Number */
            line_number: number;
            /** Item Description */
            item_description: string;
            /**
             * Uom Id
             * Format: uuid
             */
            uom_id: string;
            /** Contracted Quantity */
            contracted_quantity?: string | null;
            /** Unit Rate */
            unit_rate: string;
            /** Utilized Quantity */
            utilized_quantity: string;
            /** Hsn Code */
            hsn_code?: string | null;
        };
        /** ContractListResponse */
        ContractListResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Contract Number */
            contract_number: string;
            /** Title */
            title: string;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /** Vendor Name */
            vendor_name?: string | null;
            /** Status */
            status: string;
            /** Contract Type */
            contract_type: string;
            /** Currency */
            currency: string;
            /** Total Value */
            total_value: string;
            /**
             * Utilized Value
             * @default 0.0
             */
            utilized_value: string;
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
            /**
             * End Date
             * Format: date
             */
            end_date: string;
            /** Days Remaining */
            days_remaining: number;
            /** Expiry Warning Level */
            expiry_warning_level: string;
            /**
             * Auto Renew
             * @default false
             */
            auto_renew: boolean;
            /**
             * Amendment Count
             * @default 0
             */
            amendment_count: number;
            /** Esign Provider */
            esign_provider?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** ContractMilestoneCreate */
        ContractMilestoneCreate: {
            /** Title */
            title: string;
            /** Description */
            description?: string | null;
            /**
             * Due Date
             * Format: date
             */
            due_date: string;
            /**
             * Responsible Party
             * @default BUYER
             */
            responsible_party: string;
            /** Responsible User Id */
            responsible_user_id?: string | null;
            /** Milestone Weight */
            milestone_weight?: number | string | null;
        };
        /** ContractMilestoneResponse */
        ContractMilestoneResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Contract Id
             * Format: uuid
             */
            contract_id: string;
            /** Title */
            title: string;
            /** Description */
            description?: string | null;
            /**
             * Due Date
             * Format: date
             */
            due_date: string;
            /** Responsible Party */
            responsible_party: string;
            /** Responsible User Id */
            responsible_user_id?: string | null;
            /** Status */
            status: string;
            /** Completed At */
            completed_at?: string | null;
            /** Completion Notes */
            completion_notes?: string | null;
            /** Milestone Weight */
            milestone_weight?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** ContractMilestoneUpdate */
        ContractMilestoneUpdate: {
            /** Status */
            status: string;
            /** Completion Notes */
            completion_notes?: string | null;
        };
        /** ContractResponse */
        ContractResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Contract Number */
            contract_number: string;
            /** Title */
            title: string;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /** Rfq Id */
            rfq_id?: string | null;
            /** Arn Id */
            arn_id?: string | null;
            /** Award Recommendation Id */
            award_recommendation_id?: string | null;
            /** Status */
            status: string;
            /** Contract Type */
            contract_type: string;
            /** Currency */
            currency: string;
            /** Total Value */
            total_value: string;
            /**
             * Utilized Value
             * @default 0.0
             */
            utilized_value: string;
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
            /**
             * End Date
             * Format: date
             */
            end_date: string;
            /** Payment Term Id */
            payment_term_id?: string | null;
            /** Incoterm Id */
            incoterm_id?: string | null;
            /**
             * Business Unit Id
             * Format: uuid
             */
            business_unit_id: string;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /** Template Id */
            template_id?: string | null;
            /** Signing Log */
            signing_log?: unknown[];
            /** Signed Document Id */
            signed_document_id?: string | null;
            /** Contract Document Path */
            contract_document_path?: string | null;
            /** Signed Document Path */
            signed_document_path?: string | null;
            /** Esign Request Id */
            esign_request_id?: string | null;
            /** Esign Provider */
            esign_provider?: string | null;
            /**
             * Amendment Count
             * @default 0
             */
            amendment_count: number;
            /**
             * Renewal Alert Sent
             * @default false
             */
            renewal_alert_sent: boolean;
            /**
             * Auto Renew
             * @default false
             */
            auto_renew: boolean;
            /**
             * Renewal Notice Days
             * @default 30
             */
            renewal_notice_days: number;
            /** Sla Terms */
            sla_terms?: {
                [key: string]: unknown;
            };
            /** Erp Contract Number */
            erp_contract_number?: string | null;
            /** Activated At */
            activated_at?: string | null;
            /** Original Contract Id */
            original_contract_id?: string | null;
            /** Version */
            version: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Created By */
            created_by?: string | null;
            /** Updated By */
            updated_by?: string | null;
            /** Days Remaining */
            days_remaining?: number | null;
            /** Expiry Warning Level */
            expiry_warning_level?: string | null;
            /** Lines */
            lines?: components["schemas"]["ContractLineResponse"][];
            /** Milestones */
            milestones?: components["schemas"]["ContractMilestoneResponse"][];
            /** Amendments */
            amendments?: components["schemas"]["ContractAmendmentResponse"][];
        };
        /** ContractStatusUpdateRequest */
        ContractStatusUpdateRequest: {
            /** Status */
            status: string;
            /** Notes */
            notes?: string | null;
        };
        /** ContractTemplateResponse */
        ContractTemplateResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Name */
            name: string;
            /** Contract Type */
            contract_type: string;
            /** Template Content */
            template_content: {
                [key: string]: unknown;
            };
            /** Is Active */
            is_active: boolean;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** ContractUtilizationUpdateRequest */
        ContractUtilizationUpdateRequest: {
            /** Po Value */
            po_value: number | string;
            /** Po Number */
            po_number?: string | null;
        };
        /** CostCenterResponse */
        CostCenterResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Code */
            code: string;
            /** Name */
            name: string;
            /**
             * Business Unit Id
             * Format: uuid
             */
            business_unit_id: string;
            /** Gl Account */
            gl_account?: string | null;
            /** Erp Cost Center Code */
            erp_cost_center_code?: string | null;
            /**
             * Annual Budget
             * @default 0.0
             */
            annual_budget: string;
            /**
             * Available Budget
             * @default 0.0
             */
            available_budget: string;
            /** Budget Period Start */
            budget_period_start?: string | null;
            /** Budget Period End */
            budget_period_end?: string | null;
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
            /** Created At */
            created_at?: string | null;
            /** Updated At */
            updated_at?: string | null;
        };
        /** CurrencyCreateRequest */
        CurrencyCreateRequest: {
            /**
             * Code
             * @description ISO 4217 3-letter currency code
             */
            code: string;
            /** Name */
            name: string;
            /**
             * Symbol
             * @default
             */
            symbol: string;
            /**
             * Exchange Rate To Base
             * @default 1.0
             */
            exchange_rate_to_base: number | string;
            /**
             * Is Base Currency
             * @default false
             */
            is_base_currency: boolean;
        };
        /** CurrencyUpdateRequest */
        CurrencyUpdateRequest: {
            /** Name */
            name?: string | null;
            /** Symbol */
            symbol?: string | null;
            /** Exchange Rate To Base */
            exchange_rate_to_base?: number | string | null;
            /** Is Active */
            is_active?: boolean | null;
        };
        /** DisputeCreateRequest */
        DisputeCreateRequest: {
            /**
             * Invoice Id
             * Format: uuid
             */
            invoice_id: string;
            /** Reason Code */
            reason_code: string;
            /** Description */
            description: string;
        };
        /** DisputeMessageCreateRequest */
        DisputeMessageCreateRequest: {
            /** Message */
            message: string;
            /** Attachments */
            attachments?: string[] | null;
        };
        /** DisputeMessageResponse */
        DisputeMessageResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /**
             * Dispute Id
             * Format: uuid
             */
            dispute_id: string;
            /**
             * Sender Id
             * Format: uuid
             */
            sender_id: string;
            /** Sender Name */
            sender_name?: string | null;
            /** Message */
            message: string;
            /** Attachments */
            attachments?: string[] | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** DisputeResolveRequest */
        DisputeResolveRequest: {
            /** Resolution Notes */
            resolution_notes: string;
            /** Resolution Action */
            resolution_action: string;
            /** Credit Note Amount */
            credit_note_amount?: number | string | null;
        };
        /** DisputeResponse */
        DisputeResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /**
             * Invoice Id
             * Format: uuid
             */
            invoice_id: string;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /** Reason Code */
            reason_code: string;
            /** Description */
            description: string;
            /** Status */
            status: string;
            /**
             * Raised By
             * Format: uuid
             */
            raised_by: string;
            /** Resolved By */
            resolved_by?: string | null;
            /** Resolution Notes */
            resolution_notes?: string | null;
            /** Resolution Action */
            resolution_action?: string | null;
            /** Credit Note Amount */
            credit_note_amount?: string | null;
            /** Resolved At */
            resolved_at?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Messages */
            messages?: components["schemas"]["DisputeMessageResponse"][];
        };
        /** DuplicateCheckRequest */
        DuplicateCheckRequest: {
            /** Company Name */
            company_name?: string | null;
            /** Pan */
            pan?: string | null;
            /** Gstin */
            gstin?: string | null;
            /** Email */
            email?: string | null;
            /** Bank Account */
            bank_account?: string | null;
            /** Ifsc */
            ifsc?: string | null;
        };
        /** ERPConfigResponse */
        ERPConfigResponse: {
            /**
             * Erp Provider
             * @default SAP
             */
            erp_provider: string;
            /** Endpoint Url */
            endpoint_url?: string | null;
            /**
             * Auth Type
             * @default API_KEY
             */
            auth_type: string;
            /** Api Key Masked */
            api_key_masked?: string | null;
            /**
             * Allowed Domains
             * @default []
             */
            allowed_domains: string[];
            /**
             * Is Enabled
             * @default true
             */
            is_enabled: boolean;
            /** Updated At */
            updated_at?: string | null;
        };
        /** ERPConfigUpdateRequest */
        ERPConfigUpdateRequest: {
            /**
             * Erp Provider
             * @default SAP
             */
            erp_provider: string;
            /** Endpoint Url */
            endpoint_url?: string | null;
            /**
             * Auth Type
             * @default API_KEY
             */
            auth_type: string;
            /** Api Key */
            api_key?: string | null;
            /**
             * Allowed Domains
             * @default []
             */
            allowed_domains: string[];
            /**
             * Is Enabled
             * @default true
             */
            is_enabled: boolean;
        };
        /** EligibleLineResponse */
        EligibleLineResponse: {
            /**
             * Po Id
             * Format: uuid
             */
            po_id: string;
            /** Po Number */
            po_number: string;
            /**
             * Po Line Id
             * Format: uuid
             */
            po_line_id: string;
            /** Line Number */
            line_number: number;
            /** Item Description */
            item_description: string;
            /** Ordered Quantity */
            ordered_quantity: string;
            /** Unit Price */
            unit_price: string;
            /** Tax Rate */
            tax_rate: string;
            /** Received Quantity */
            received_quantity: string;
            /** Already Invoiced Quantity */
            already_invoiced_quantity: string;
            /** Eligible Quantity */
            eligible_quantity: string;
        };
        /** ErpPaymentWebhookRequest */
        ErpPaymentWebhookRequest: {
            /** Invoice Number */
            invoice_number: string;
            /** Utr Number */
            utr_number: string;
            /** Amount */
            amount: number | string;
            /**
             * Payment Date
             * Format: date
             */
            payment_date: string;
            /**
             * Payment Method
             * @default NEFT
             */
            payment_method: string | null;
            /** Erp Reference */
            erp_reference?: string | null;
        };
        /** EsignConfirmRequest */
        EsignConfirmRequest: {
            /** Signed Doc Path */
            signed_doc_path?: string | null;
            /** Request Id */
            request_id?: string | null;
        };
        /** EsignInitiateRequest */
        EsignInitiateRequest: {
            /** Provider */
            provider?: string | null;
            /** Signatories */
            signatories?: {
                [key: string]: unknown;
            }[] | null;
        };
        /** EsignInitiateResponse */
        EsignInitiateResponse: {
            /** Request Id */
            request_id: string;
            /** Provider */
            provider: string;
            /** Signing Url */
            signing_url?: string | null;
            /** Status */
            status: string;
        };
        /** EsignWebhookPayload */
        EsignWebhookPayload: {
            /** Request Id */
            request_id: string;
            /** Event */
            event: string;
            /** Status */
            status?: string | null;
            /** Signed Pdf Base64 */
            signed_pdf_base64?: string | null;
            /** Metadata */
            metadata?: {
                [key: string]: unknown;
            } | null;
        };
        /** ExportRequest */
        ExportRequest: {
            /** Data */
            data?: {
                [key: string]: unknown;
            }[] | null;
            /** Columns */
            columns?: string[] | null;
            /** Filename */
            filename?: string | null;
            /**
             * Sheet Name
             * @default Analytics
             */
            sheet_name: string | null;
            /** Report Type */
            report_type?: string | null;
            /** Fiscal Year */
            fiscal_year?: string | null;
            /** Group By */
            group_by?: string | null;
        };
        /** ExtendDeadlineRequest */
        ExtendDeadlineRequest: {
            /**
             * New Bid Close At
             * Format: date-time
             */
            new_bid_close_at: string;
            /** Reason */
            reason: string;
        };
        /** ForceAdvanceRequest */
        ForceAdvanceRequest: {
            /** Reason */
            reason: string;
        };
        /** GrnCreateRequest */
        GrnCreateRequest: {
            /**
             * Po Id
             * Format: uuid
             */
            po_id: string;
            /** Receipt Date */
            receipt_date?: string | null;
            /** Challan Number */
            challan_number?: string | null;
            /** Challan Date */
            challan_date?: string | null;
            /** Transporter Name */
            transporter_name?: string | null;
            /** Lr Number */
            lr_number?: string | null;
            /** Notes */
            notes?: string | null;
            /** Lines */
            lines: components["schemas"]["GrnLineCreate"][];
        };
        /** GrnLineCreate */
        GrnLineCreate: {
            /**
             * Po Line Id
             * Format: uuid
             */
            po_line_id: string;
            /** Received Quantity */
            received_quantity: number | string;
            /**
             * Qc Required
             * @default false
             */
            qc_required: boolean;
            /** Rejection Reason */
            rejection_reason?: string | null;
        };
        /** GrnLineResponse */
        GrnLineResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Grn Id
             * Format: uuid
             */
            grn_id: string;
            /**
             * Po Line Id
             * Format: uuid
             */
            po_line_id: string;
            /** Received Quantity */
            received_quantity: string;
            /** Accepted Quantity */
            accepted_quantity: string;
            /**
             * Rejected Quantity
             * @default 0
             */
            rejected_quantity: string;
            /** Rejection Reason */
            rejection_reason?: string | null;
            /**
             * Qc Required
             * @default false
             */
            qc_required: boolean;
            /** Qc Status */
            qc_status: string;
            /** Inspections */
            inspections?: components["schemas"]["QualityInspectionResponse"][];
        };
        /** GrnResponse */
        GrnResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Grn Number */
            grn_number: string;
            /**
             * Po Id
             * Format: uuid
             */
            po_id: string;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /**
             * Receipt Date
             * Format: date
             */
            receipt_date: string;
            /**
             * Received By
             * Format: uuid
             */
            received_by: string;
            /** Challan Number */
            challan_number?: string | null;
            /** Challan Date */
            challan_date?: string | null;
            /** Transporter Name */
            transporter_name?: string | null;
            /** Lr Number */
            lr_number?: string | null;
            /** Status */
            status: string;
            /** Erp Grn Number */
            erp_grn_number?: string | null;
            /** Notes */
            notes?: string | null;
            /** Grn Document Path */
            grn_document_path?: string | null;
            /** Confirmed At */
            confirmed_at?: string | null;
            /** Confirmed By */
            confirmed_by?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Lines */
            lines?: components["schemas"]["GrnLineResponse"][];
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** HolidayCreateRequest */
        HolidayCreateRequest: {
            /** Name */
            name: string;
            /**
             * Holiday Date
             * Format: date
             */
            holiday_date: string;
            /** Plant Id */
            plant_id?: string | null;
        };
        /** IntegrationJobResponse */
        IntegrationJobResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Job Type */
            job_type: string;
            /** Entity Type */
            entity_type: string;
            /**
             * Entity Id
             * Format: uuid
             */
            entity_id: string;
            /** Direction */
            direction: string;
            /** Adapter Type */
            adapter_type: string;
            /** Status */
            status: string;
            /** Request Payload */
            request_payload?: {
                [key: string]: unknown;
            } | null;
            /** Response Payload */
            response_payload?: {
                [key: string]: unknown;
            } | null;
            /** Error Message */
            error_message?: string | null;
            /**
             * Retry Count
             * @default 0
             */
            retry_count: number;
            /**
             * Max Retries
             * @default 7
             */
            max_retries: number;
            /** Next Retry At */
            next_retry_at?: string | null;
            /** Completed At */
            completed_at?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Updated At */
            updated_at?: string | null;
        };
        /** IntegrationStatsResponse */
        IntegrationStatsResponse: {
            /** Total Jobs */
            total_jobs: number;
            /** Pending Jobs */
            pending_jobs: number;
            /** In Progress Jobs */
            in_progress_jobs: number;
            /** Completed Jobs */
            completed_jobs: number;
            /** Failed Jobs */
            failed_jobs: number;
            /** Retry Scheduled Jobs */
            retry_scheduled_jobs: number;
            /** Success Rate */
            success_rate: number;
        };
        /** InvoiceDisputeRequest */
        InvoiceDisputeRequest: {
            /** Reason Code */
            reason_code: string;
            /** Description */
            description: string;
        };
        /** InvoiceLineCreate */
        InvoiceLineCreate: {
            /**
             * Po Line Id
             * Format: uuid
             */
            po_line_id: string;
            /** Grn Line Id */
            grn_line_id?: string | null;
            /** Line Number */
            line_number: number;
            /** Item Description */
            item_description: string;
            /** Quantity */
            quantity: number | string;
            /** Unit Price */
            unit_price: number | string;
            /**
             * Tax Rate
             * @default 0.0
             */
            tax_rate: number | string;
            /**
             * Tax Amount
             * @default 0.0
             */
            tax_amount: number | string;
            /** Line Total */
            line_total?: number | string | null;
        };
        /** InvoiceLineResponse */
        InvoiceLineResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Invoice Id
             * Format: uuid
             */
            invoice_id: string;
            /**
             * Po Line Id
             * Format: uuid
             */
            po_line_id: string;
            /** Grn Line Id */
            grn_line_id?: string | null;
            /** Line Number */
            line_number: number;
            /** Item Description */
            item_description: string;
            /** Quantity */
            quantity: string;
            /** Unit Price */
            unit_price: string;
            /** Tax Rate */
            tax_rate: string;
            /** Tax Amount */
            tax_amount: string;
            /** Line Total */
            line_total: string;
        };
        /** InvoiceMatchLineResultResponse */
        InvoiceMatchLineResultResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Invoice Line Id
             * Format: uuid
             */
            invoice_line_id: string;
            /**
             * Po Line Id
             * Format: uuid
             */
            po_line_id: string;
            /** Price Match */
            price_match: boolean;
            /** Price Deviation */
            price_deviation?: string | null;
            /** Quantity Match */
            quantity_match: boolean;
            /** Quantity Deviation */
            quantity_deviation?: string | null;
            /** Po Reference Valid */
            po_reference_valid: boolean;
            /** Tax Match */
            tax_match: boolean;
            /** Tax Deviation */
            tax_deviation: string;
            /** Overall Match */
            overall_match: boolean;
            /** Mismatch Reasons */
            mismatch_reasons?: string[] | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** InvoiceRejectRequest */
        InvoiceRejectRequest: {
            /** Rejection Reason */
            rejection_reason: string;
        };
        /** InvoiceResponse */
        InvoiceResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Invoice Number */
            invoice_number: string;
            /** Vendor Invoice Number */
            vendor_invoice_number: string;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /** Vendor Name */
            vendor_name?: string | null;
            /**
             * Po Id
             * Format: uuid
             */
            po_id: string;
            /** Po Number */
            po_number?: string | null;
            /** Status */
            status: string;
            /**
             * Invoice Date
             * Format: date
             */
            invoice_date: string;
            /**
             * Due Date
             * Format: date
             */
            due_date: string;
            /** Currency */
            currency: string;
            /** Subtotal */
            subtotal: string;
            /** Tax Amount */
            tax_amount: string;
            /** Total Amount */
            total_amount: string;
            /**
             * Tds Amount
             * @default 0.0
             */
            tds_amount: string | null;
            /** Financial Year */
            financial_year?: string | null;
            /** Payment Terms Code */
            payment_terms_code?: string | null;
            /** Match Status */
            match_status: string;
            /** Price Tolerance */
            price_tolerance: string;
            /** Erp Invoice Number */
            erp_invoice_number?: string | null;
            /** Erp Sync Status */
            erp_sync_status: string;
            /** Payment Status */
            payment_status: string;
            /** Paid Amount */
            paid_amount: string;
            /** Notes */
            notes?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Lines */
            lines?: components["schemas"]["InvoiceLineResponse"][];
            /** Match Results */
            match_results?: components["schemas"]["InvoiceMatchLineResultResponse"][];
        };
        /** InvoiceSubmitRequest */
        InvoiceSubmitRequest: {
            /**
             * Po Id
             * Format: uuid
             */
            po_id: string;
            /** Vendor Invoice Number */
            vendor_invoice_number: string;
            /**
             * Invoice Date
             * Format: date
             */
            invoice_date: string;
            /** Due Date */
            due_date?: string | null;
            /**
             * Currency
             * @default INR
             */
            currency: string;
            /** Subtotal */
            subtotal: number | string;
            /**
             * Tax Amount
             * @default 0.0
             */
            tax_amount: number | string;
            /** Total Amount */
            total_amount: number | string;
            /** Payment Terms Code */
            payment_terms_code?: string | null;
            /** Notes */
            notes?: string | null;
            /** Lines */
            lines: components["schemas"]["InvoiceLineCreate"][];
        };
        /** Links */
        Links: {
            /** Self */
            self?: string | null;
            /** Next */
            next?: string | null;
            /** Prev */
            prev?: string | null;
            /** Related */
            related?: {
                [key: string]: string;
            } | null;
            /** Self */
            self_?: string | null;
            /** Next */
            next_?: string | null;
            /** Prev */
            prev_?: string | null;
        };
        /** LiveAuctionDetailResponse */
        LiveAuctionDetailResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /** Rfq Number */
            rfq_number?: string | null;
            /** Rfq Title */
            rfq_title?: string | null;
            /** Status */
            status: string;
            /** Config */
            config: {
                [key: string]: unknown;
            };
            /**
             * Scheduled Start At
             * Format: date-time
             */
            scheduled_start_at: string;
            /** Actual Start At */
            actual_start_at?: string | null;
            /**
             * Current Close At
             * Format: date-time
             */
            current_close_at: string;
            /** Extension Count */
            extension_count: number;
            /** Winner Vendor Id */
            winner_vendor_id?: string | null;
            /** Winning Bid Id */
            winning_bid_id?: string | null;
            /**
             * Created By
             * Format: uuid
             */
            created_by: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * LocationCreateRequest
         * @description Payload for creating a new DeliveryLocation.
         */
        LocationCreateRequest: {
            /**
             * Code
             * @description Unique location code within the org
             */
            code: string;
            /**
             * Name
             * @description Human-readable location name
             */
            name: string;
            /**
             * Address
             * @description Full street address
             */
            address: string;
            /** City */
            city: string;
            /** State */
            state: string;
            /** Postal Code */
            postal_code: string;
            /**
             * Country Code
             * @description ISO 3166-1 alpha-2 country code
             * @default IN
             */
            country_code: string;
            /**
             * Plant Id
             * @description Optional FK to plants table
             */
            plant_id?: string | null;
        };
        /**
         * LocationUpdateRequest
         * @description Payload for partial update of a DeliveryLocation. All fields optional.
         */
        LocationUpdateRequest: {
            /** Name */
            name?: string | null;
            /** Address */
            address?: string | null;
            /** City */
            city?: string | null;
            /** State */
            state?: string | null;
            /** Postal Code */
            postal_code?: string | null;
            /** Country Code */
            country_code?: string | null;
            /** Plant Id */
            plant_id?: string | null;
        };
        /** LoginRequest */
        LoginRequest: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Password */
            password: string;
            /** Org Id */
            org_id?: string | null;
        };
        /** MFAConfirmRequest */
        MFAConfirmRequest: {
            /** Totp Code */
            totp_code: string;
        };
        /** MFAVerifyRequest */
        MFAVerifyRequest: {
            /** Mfa Token */
            mfa_token: string;
            /** Totp Code */
            totp_code: string;
        };
        /** MappingSuggestionItem */
        MappingSuggestionItem: {
            /**
             * Target Id
             * Format: uuid
             */
            target_id: string;
            /** Label */
            label: string;
            /** Confidence */
            confidence: number;
            /** Method */
            method: string;
        };
        /** NegotiatedPriceSubmitRequest */
        NegotiatedPriceSubmitRequest: {
            /**
             * Negotiated Price
             * @description Revised negotiated total price in INR
             */
            negotiated_price: number | string;
            /** Notes */
            notes?: string | null;
        };
        /** NegotiationResponse */
        NegotiationResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /** Cs Id */
            cs_id?: string | null;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /** Round Number */
            round_number: number;
            /** Original Price */
            original_price?: string | null;
            /** Negotiated Price */
            negotiated_price?: string | null;
            /** Price Change Pct */
            price_change_pct?: string | null;
            /** Proposed Price */
            proposed_price?: string | null;
            /** Counter Price */
            counter_price?: string | null;
            /** Status */
            status: string;
            /** Notes */
            notes?: string | null;
            /**
             * Negotiated By
             * Format: uuid
             */
            negotiated_by: string;
            /** Initiated By */
            initiated_by?: string | null;
            /** Created At */
            created_at?: string | null;
        };
        /** NegotiationStartRequest */
        NegotiationStartRequest: {
            /**
             * Vendor Ids
             * @description Shortlisted vendor IDs to initiate negotiations with
             */
            vendor_ids: string[];
            /** Notes */
            notes?: string | null;
        };
        /** NotificationPreferenceItem */
        NotificationPreferenceItem: {
            /** Notification Type */
            notification_type: string;
            /**
             * Email Enabled
             * @default true
             */
            email_enabled: boolean;
            /**
             * Sms Enabled
             * @default false
             */
            sms_enabled: boolean;
            /**
             * Inapp Enabled
             * @default true
             */
            inapp_enabled: boolean;
            /**
             * Digest Mode
             * @default false
             */
            digest_mode: boolean;
            /** Quiet Hours Start */
            quiet_hours_start?: string | null;
            /** Quiet Hours End */
            quiet_hours_end?: string | null;
        };
        /** NotificationPreferencesUpdateRequest */
        NotificationPreferencesUpdateRequest: {
            /** Preferences */
            preferences: components["schemas"]["NotificationPreferenceItem"][];
        };
        /** POAcknowledgeRequest */
        POAcknowledgeRequest: {
            /**
             * Accepted
             * @default true
             */
            accepted: boolean;
            /** Rejection Reason */
            rejection_reason?: string | null;
        };
        /** POAmendRequest */
        POAmendRequest: {
            /** Reason */
            reason: string;
            /**
             * Value Change
             * @default 0.0
             */
            value_change: number | string | null;
            /** Field Changes */
            field_changes?: {
                [key: string]: unknown;
            };
            /** Line Updates */
            line_updates?: {
                [key: string]: unknown;
            }[] | null;
        };
        /** POAmendmentResponse */
        POAmendmentResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Po Id
             * Format: uuid
             */
            po_id: string;
            /** Amendment Number */
            amendment_number: number;
            /** Reason */
            reason: string;
            /** Field Changes */
            field_changes: {
                [key: string]: unknown;
            };
            /** Value Change */
            value_change: string;
            /** Re Approval Required */
            re_approval_required: boolean;
            /**
             * Amended By
             * Format: uuid
             */
            amended_by: string;
            /** Approved By */
            approved_by?: string | null;
            /** Approved At */
            approved_at?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** POCancelRequest */
        POCancelRequest: {
            /** Cancellation Reason */
            cancellation_reason: string;
        };
        /** POCreateRequest */
        POCreateRequest: {
            /** Title */
            title: string;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /**
             * Business Unit Id
             * Format: uuid
             */
            business_unit_id: string;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /**
             * Currency
             * @default INR
             */
            currency: string;
            /** Lines */
            lines: components["schemas"]["POLineCreate"][];
            /** Rfq Id */
            rfq_id?: string | null;
            /** Arn Id */
            arn_id?: string | null;
            /** Contract Id */
            contract_id?: string | null;
            /** Plant Id */
            plant_id?: string | null;
            /** Payment Term Id */
            payment_term_id?: string | null;
            /** Incoterm Id */
            incoterm_id?: string | null;
            /** Delivery Location Id */
            delivery_location_id?: string | null;
            /** Expected Delivery Date */
            expected_delivery_date?: string | null;
            /** Deviation Justification */
            deviation_justification?: string | null;
            /**
             * Po Type
             * @default STANDARD
             */
            po_type: string | null;
        };
        /** POFromAwardRequest */
        POFromAwardRequest: {
            /**
             * Arn Id
             * Format: uuid
             */
            arn_id: string;
            /** Deviation Justification */
            deviation_justification?: string | null;
        };
        /** POLineCreate */
        POLineCreate: {
            /** Item Description */
            item_description: string;
            /** Item Code */
            item_code?: string | null;
            /**
             * Uom Id
             * Format: uuid
             */
            uom_id: string;
            /** Ordered Quantity */
            ordered_quantity: number | string;
            /** Unit Price */
            unit_price: number | string;
            /** Awarded Unit Price */
            awarded_unit_price?: number | string | null;
            /** Hsn Code */
            hsn_code?: string | null;
            /**
             * Tax Rate
             * @default 0.0
             */
            tax_rate: number | string;
            /** Delivery Date */
            delivery_date?: string | null;
        };
        /** POLineResponse */
        POLineResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /**
             * Po Id
             * Format: uuid
             */
            po_id: string;
            /** Line Number */
            line_number: number;
            /** Item Description */
            item_description: string;
            /** Item Code */
            item_code?: string | null;
            /**
             * Uom Id
             * Format: uuid
             */
            uom_id: string;
            /** Ordered Quantity */
            ordered_quantity: string;
            /** Unit Price */
            unit_price: string;
            /** Total Price */
            total_price?: string | null;
            /** Awarded Unit Price */
            awarded_unit_price?: string | null;
            /** Hsn Code */
            hsn_code?: string | null;
            /** Tax Rate */
            tax_rate: string;
            /** Open Quantity */
            open_quantity: string;
            /**
             * Received Quantity
             * @default 0
             */
            received_quantity: string;
            /**
             * Invoiced Quantity
             * @default 0
             */
            invoiced_quantity: string;
            /** Delivery Date */
            delivery_date?: string | null;
            /** Created At */
            created_at?: string | null;
        };
        /** POResponse */
        POResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Po Number */
            po_number: string;
            /** Title */
            title: string;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /** Vendor Name */
            vendor_name?: string | null;
            /** Rfq Id */
            rfq_id?: string | null;
            /** Arn Id */
            arn_id?: string | null;
            /** Contract Id */
            contract_id?: string | null;
            /** Status */
            status: string;
            /**
             * Business Unit Id
             * Format: uuid
             */
            business_unit_id: string;
            /** Plant Id */
            plant_id?: string | null;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /** Currency */
            currency: string;
            /** Total Value */
            total_value: string;
            /** Payment Term Id */
            payment_term_id?: string | null;
            /** Incoterm Id */
            incoterm_id?: string | null;
            /** Delivery Location Id */
            delivery_location_id?: string | null;
            /** Expected Delivery Date */
            expected_delivery_date?: string | null;
            /**
             * Buyer Id
             * Format: uuid
             */
            buyer_id: string;
            /** Erp Po Number */
            erp_po_number?: string | null;
            /** Erp Sync Status */
            erp_sync_status: string;
            /** Po Document Path */
            po_document_path?: string | null;
            /** Sent At */
            sent_at?: string | null;
            /** Acknowledged At */
            acknowledged_at?: string | null;
            /** Vendor Acknowledged At */
            vendor_acknowledged_at?: string | null;
            /** Rejected Reason */
            rejected_reason?: string | null;
            /** Vendor Rejection Reason */
            vendor_rejection_reason?: string | null;
            /** Deviation Justification */
            deviation_justification?: string | null;
            /** Cancellation Reason */
            cancellation_reason?: string | null;
            /** Amendment Count */
            amendment_count: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Lines */
            lines?: components["schemas"]["POLineResponse"][];
            /** Amendments */
            amendments?: components["schemas"]["POAmendmentResponse"][];
        };
        /** PRApprovalAction */
        PRApprovalAction: {
            /** Action */
            action: string;
            /** Comment */
            comment?: string | null;
        };
        /** PRBulkCreateRequest */
        PRBulkCreateRequest: {
            /** Items */
            items: components["schemas"]["PRCreateRequest"][];
        };
        /** PRCreateRequest */
        PRCreateRequest: {
            /** Title */
            title: string;
            /** Description */
            description?: string | null;
            /** @default OPEX */
            procurement_type: components["schemas"]["ProcurementType"];
            /**
             * Business Unit Id
             * Format: uuid
             */
            business_unit_id: string;
            /** Plant Id */
            plant_id?: string | null;
            /** Department Id */
            department_id?: string | null;
            /**
             * Cost Center Id
             * Format: uuid
             */
            cost_center_id: string;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /**
             * Currency
             * @default INR
             */
            currency: string;
            /**
             * Is Emergency
             * @default false
             */
            is_emergency: boolean;
            /**
             * Is Capex
             * @default false
             */
            is_capex: boolean;
            /** Required By Date */
            required_by_date?: string | null;
            /** Delivery Location Id */
            delivery_location_id?: string | null;
            /** Lines */
            lines?: components["schemas"]["PRLineItemRequest"][];
        };
        /** PRDetailResponse */
        PRDetailResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Pr Number */
            pr_number: string;
            /** Title */
            title: string;
            /** Description */
            description?: string | null;
            /** Source */
            source: string;
            /** Status */
            status: string;
            /** Procurement Type */
            procurement_type: string;
            /**
             * Requestor Id
             * Format: uuid
             */
            requestor_id: string;
            /**
             * Business Unit Id
             * Format: uuid
             */
            business_unit_id: string;
            /** Plant Id */
            plant_id?: string | null;
            /** Department Id */
            department_id?: string | null;
            /**
             * Cost Center Id
             * Format: uuid
             */
            cost_center_id: string;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /** Currency */
            currency: string;
            /** Estimated Value */
            estimated_value: string;
            /** Budget Check Status */
            budget_check_status: string;
            /** Budget Reserved Amount */
            budget_reserved_amount: string;
            /** Is Emergency */
            is_emergency: boolean;
            /** Is Capex */
            is_capex: boolean;
            /** Required By Date */
            required_by_date?: string | null;
            /** Delivery Location Id */
            delivery_location_id?: string | null;
            /** Erp Pr Number */
            erp_pr_number?: string | null;
            /** Erp Sync Status */
            erp_sync_status: string;
            /** Merged From */
            merged_from?: string[] | null;
            /** Split Into */
            split_into?: string[] | null;
            /** Split From */
            split_from?: string | null;
            /** Approved At */
            approved_at?: string | null;
            /** Aging Alert Level */
            aging_alert_level: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Created By */
            created_by?: string | null;
            /** Updated By */
            updated_by?: string | null;
            /** Lines */
            lines?: components["schemas"]["PRLineItemResponse"][];
        };
        /** PRLineItemRequest */
        PRLineItemRequest: {
            /** Line Number */
            line_number: number;
            /** Item Description */
            item_description: string;
            /** Item Code */
            item_code?: string | null;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /**
             * Uom Id
             * Format: uuid
             */
            uom_id: string;
            /** Quantity */
            quantity: number | string;
            /**
             * Estimated Unit Price
             * @default 0.0
             */
            estimated_unit_price: number | string;
            /** Hsn Code */
            hsn_code?: string | null;
            /** Specifications */
            specifications?: string | null;
            /** Required By Date */
            required_by_date?: string | null;
            /** Delivery Location Id */
            delivery_location_id?: string | null;
        };
        /** PRLineItemResponse */
        PRLineItemResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Requisition Id
             * Format: uuid
             */
            requisition_id: string;
            /** Line Number */
            line_number: number;
            /** Item Description */
            item_description: string;
            /** Item Code */
            item_code?: string | null;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /**
             * Uom Id
             * Format: uuid
             */
            uom_id: string;
            /** Quantity */
            quantity: string;
            /** Estimated Unit Price */
            estimated_unit_price: string;
            /** Estimated Total */
            estimated_total?: string | null;
            /** Hsn Code */
            hsn_code?: string | null;
            /** Specifications */
            specifications?: string | null;
            /** Required By Date */
            required_by_date?: string | null;
            /** Delivery Location Id */
            delivery_location_id?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** PRListResponse */
        PRListResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Pr Number */
            pr_number: string;
            /** Title */
            title: string;
            /** Source */
            source: string;
            /** Status */
            status: string;
            /** Procurement Type */
            procurement_type: string;
            /**
             * Requestor Id
             * Format: uuid
             */
            requestor_id: string;
            /**
             * Business Unit Id
             * Format: uuid
             */
            business_unit_id: string;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /** Currency */
            currency: string;
            /** Estimated Value */
            estimated_value: string;
            /** Budget Check Status */
            budget_check_status: string;
            /** Required By Date */
            required_by_date?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** PRMergeRequest */
        PRMergeRequest: {
            /** Pr Ids */
            pr_ids: string[];
            /** Merged Title */
            merged_title?: string | null;
        };
        /** PRSplitItem */
        PRSplitItem: {
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /** Line Numbers */
            line_numbers: number[];
            /** Title */
            title?: string | null;
            /** Cost Center Id */
            cost_center_id?: string | null;
        };
        /** PRSplitRequest */
        PRSplitRequest: {
            /** Splits */
            splits: components["schemas"]["PRSplitItem"][];
        };
        /** PRUpdateRequest */
        PRUpdateRequest: {
            /** Title */
            title?: string | null;
            /** Description */
            description?: string | null;
            procurement_type?: components["schemas"]["ProcurementType"] | null;
            /** Business Unit Id */
            business_unit_id?: string | null;
            /** Plant Id */
            plant_id?: string | null;
            /** Department Id */
            department_id?: string | null;
            /** Cost Center Id */
            cost_center_id?: string | null;
            /** Category Id */
            category_id?: string | null;
            /** Currency */
            currency?: string | null;
            /** Is Emergency */
            is_emergency?: boolean | null;
            /** Is Capex */
            is_capex?: boolean | null;
            /** Required By Date */
            required_by_date?: string | null;
            /** Delivery Location Id */
            delivery_location_id?: string | null;
            /** Lines */
            lines?: components["schemas"]["PRLineItemRequest"][] | null;
        };
        /** PaginationMeta */
        PaginationMeta: {
            /** Total */
            total?: number | null;
            /**
             * Page
             * @default 1
             */
            page: number | null;
            /**
             * Page Size
             * @default 20
             */
            page_size: number | null;
            /**
             * Total Count
             * @default 0
             */
            total_count: number;
            /**
             * Total Pages
             * @default 1
             */
            total_pages: number;
            /**
             * Has Next
             * @default false
             */
            has_next: boolean;
            /**
             * Has Prev
             * @default false
             */
            has_prev: boolean;
            /** Next Cursor */
            next_cursor?: string | null;
            /** Prev Cursor */
            prev_cursor?: string | null;
            /** Page Number */
            page_number?: number | null;
            /** Total Records */
            total_records?: number | null;
            /** Has Next Page */
            has_next_page?: boolean | null;
            /** Has Prev Page */
            has_prev_page?: boolean | null;
            /** Unread Count */
            unread_count?: number | null;
        };
        /** PaymentProcessRequest */
        PaymentProcessRequest: {
            /** Utr Number */
            utr_number: string;
            /**
             * Payment Method
             * @default NEFT
             */
            payment_method: string;
            /** Payment Date */
            payment_date?: string | null;
            /** Erp Payment Reference */
            erp_payment_reference?: string | null;
        };
        /** PaymentRecordResponse */
        PaymentRecordResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /**
             * Invoice Id
             * Format: uuid
             */
            invoice_id: string;
            /** Invoice Number */
            invoice_number?: string | null;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /** Vendor Name */
            vendor_name?: string | null;
            /**
             * Payment Date
             * Format: date
             */
            payment_date: string;
            /** Amount */
            amount: string;
            /**
             * Gross Amount
             * @default 0.0
             */
            gross_amount: string | null;
            /**
             * Tds Amount
             * @default 0.0
             */
            tds_amount: string | null;
            /**
             * Net Amount
             * @default 0.0
             */
            net_amount: string | null;
            /** Payment Due Date */
            payment_due_date?: string | null;
            /** Currency */
            currency: string;
            /** Utr Number */
            utr_number?: string | null;
            /** Payment Method */
            payment_method?: string | null;
            /** Erp Payment Reference */
            erp_payment_reference?: string | null;
            /** Status */
            status: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** PaymentScheduleRequest */
        PaymentScheduleRequest: {
            /**
             * Invoice Id
             * Format: uuid
             */
            invoice_id: string;
        };
        /** PaymentTermCreateRequest */
        PaymentTermCreateRequest: {
            /** Code */
            code: string;
            /** Name */
            name: string;
            /** Net Days */
            net_days: number;
            /**
             * Discount Percentage
             * @default 0
             */
            discount_percentage: number | string;
            /**
             * Discount Days
             * @default 0
             */
            discount_days: number;
            /** Description */
            description?: string | null;
        };
        /** PaymentTermUpdateRequest */
        PaymentTermUpdateRequest: {
            /** Name */
            name?: string | null;
            /** Net Days */
            net_days?: number | null;
            /** Discount Percentage */
            discount_percentage?: number | string | null;
            /** Discount Days */
            discount_days?: number | null;
            /** Description */
            description?: string | null;
        };
        /** PennyTestConfirmRequest */
        PennyTestConfirmRequest: {
            /** Amount Received */
            amount_received: number;
        };
        /**
         * ProcurementType
         * @enum {string}
         */
        ProcurementType: "CAPEX" | "OPEX" | "PROJECT" | "MRO" | "SERVICES";
        /** QualityInspectionCreate */
        QualityInspectionCreate: {
            /**
             * Grn Line Id
             * Format: uuid
             */
            grn_line_id: string;
            /** Result */
            result: string;
            /** Accepted Quantity */
            accepted_quantity: number | string;
            /**
             * Rejected Quantity
             * @default 0.0
             */
            rejected_quantity: number | string;
            /** Remarks */
            remarks?: string | null;
            /** Inspection Date */
            inspection_date?: string | null;
        };
        /** QualityInspectionResponse */
        QualityInspectionResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Grn Line Id
             * Format: uuid
             */
            grn_line_id: string;
            /**
             * Inspector Id
             * Format: uuid
             */
            inspector_id: string;
            /**
             * Inspection Date
             * Format: date
             */
            inspection_date: string;
            /** Result */
            result: string;
            /** Accepted Quantity */
            accepted_quantity: string;
            /** Rejected Quantity */
            rejected_quantity: string;
            /** Remarks */
            remarks?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** RegretLettersResponse */
        RegretLettersResponse: {
            /** Sent To Vendors */
            sent_to_vendors: string[];
            /** Count */
            count: number;
            /** Message */
            message: string;
        };
        /** RfqClarificationResponse */
        RfqClarificationResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /** Question */
            question: string;
            /** Answer */
            answer?: string | null;
            /**
             * Asked By
             * Format: uuid
             */
            asked_by: string;
            /** Asked By Vendor Id */
            asked_by_vendor_id?: string | null;
            /** Answered By */
            answered_by?: string | null;
            /** Answered At */
            answered_at?: string | null;
            /** Is Published */
            is_published: boolean;
            /** Published At */
            published_at?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** RfqCreateRequest */
        RfqCreateRequest: {
            /** Title */
            title: string;
            /** Description */
            description?: string | null;
            /**
             * Rfq Type
             * @default LIMITED_TENDER
             */
            rfq_type: string;
            /**
             * Sourcing Type
             * @default GOODS
             */
            sourcing_type: string;
            /**
             * Evaluation Type
             * @default L1_PRICE_ONLY
             */
            evaluation_type: string;
            /**
             * Procurement Type
             * @default OPEX
             */
            procurement_type: string;
            /**
             * Business Unit Id
             * Format: uuid
             */
            business_unit_id: string;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /**
             * Currency
             * @default INR
             */
            currency: string;
            /**
             * Estimated Value
             * @default 0.0
             */
            estimated_value: number | string;
            /** Payment Term Id */
            payment_term_id?: string | null;
            /** Incoterm Id */
            incoterm_id?: string | null;
            /** Delivery Location Id */
            delivery_location_id?: string | null;
            /**
             * Bid Close At
             * Format: date-time
             */
            bid_close_at: string;
            /** Bid Open At */
            bid_open_at?: string | null;
            /**
             * Bid Validity Days
             * @default 90
             */
            bid_validity_days: number;
            /**
             * Is Multi Lot
             * @default false
             */
            is_multi_lot: boolean;
            /**
             * Lot Participation Mode
             * @default MANDATORY_ALL
             */
            lot_participation_mode: string;
            /** Source Pr Id */
            source_pr_id?: string | null;
            /** Lots */
            lots?: components["schemas"]["RfqLotCreateRequest"][];
            /** Lines */
            lines?: components["schemas"]["RfqLineCreateRequest"][];
        };
        /** RfqDashboardResponse */
        RfqDashboardResponse: {
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /** Status */
            status: string;
            /** Bid Count */
            bid_count: number;
            /** Bids Opened */
            bids_opened: boolean;
            /** Participant Count */
            participant_count: number;
            /** Clarification Count */
            clarification_count: number;
            /** Unanswered Clarifications */
            unanswered_clarifications: number;
            /** Bid Opening Step */
            bid_opening_step: number;
            /** Days To Deadline */
            days_to_deadline?: number | null;
        };
        /** RfqDetailResponse */
        RfqDetailResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Rfq Number */
            rfq_number: string;
            /** Title */
            title: string;
            /** Description */
            description?: string | null;
            /** Rfq Type */
            rfq_type: string;
            /** Sourcing Type */
            sourcing_type: string;
            /** Evaluation Type */
            evaluation_type: string;
            /** Procurement Type */
            procurement_type: string;
            /** Status */
            status: string;
            /**
             * Buyer Id
             * Format: uuid
             */
            buyer_id: string;
            /**
             * Business Unit Id
             * Format: uuid
             */
            business_unit_id: string;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /** Currency */
            currency: string;
            /** Estimated Value */
            estimated_value: string;
            /** Bid Close At */
            bid_close_at?: string | null;
            /** Bid Open At */
            bid_open_at?: string | null;
            /** Bid Validity Days */
            bid_validity_days: number;
            /** Is Multi Lot */
            is_multi_lot: boolean;
            /** Is Emergency */
            is_emergency: boolean;
            /** Is Single Vendor */
            is_single_vendor: boolean;
            /** Amendment Count */
            amendment_count: number;
            /** Published At */
            published_at?: string | null;
            /** Bids Opened At */
            bids_opened_at?: string | null;
            /** Bid Opening Initiated By */
            bid_opening_initiated_by?: string | null;
            /** Bid Opening Initiated At */
            bid_opening_initiated_at?: string | null;
            /** Cancelled At */
            cancelled_at?: string | null;
            /** Cancel Reason */
            cancel_reason?: string | null;
            /** Source Pr Id */
            source_pr_id?: string | null;
            /** Created By */
            created_by?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            /** Lots */
            lots?: components["schemas"]["RfqLotResponse"][];
            /** Lines */
            lines?: components["schemas"]["RfqLineResponse"][];
            /** Participants */
            participants?: components["schemas"]["RfqParticipantResponse"][];
            /** Clarifications */
            clarifications?: components["schemas"]["RfqClarificationResponse"][];
        };
        /** RfqLineCreateRequest */
        RfqLineCreateRequest: {
            /** Lot Id */
            lot_id?: string | null;
            /** Line Number */
            line_number: number;
            /** Item Description */
            item_description: string;
            /** Item Code */
            item_code?: string | null;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /**
             * Uom Id
             * Format: uuid
             */
            uom_id: string;
            /** Quantity */
            quantity: number | string;
            /**
             * Estimated Unit Price
             * @default 0.0
             */
            estimated_unit_price: number | string;
            /** Hsn Code */
            hsn_code?: string | null;
            /** Specifications */
            specifications?: string | null;
            /** Required By Date */
            required_by_date?: string | null;
            /** Delivery Location Id */
            delivery_location_id?: string | null;
        };
        /** RfqLineResponse */
        RfqLineResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /** Lot Id */
            lot_id?: string | null;
            /** Line Number */
            line_number: number;
            /** Item Description */
            item_description: string;
            /** Item Code */
            item_code?: string | null;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /**
             * Uom Id
             * Format: uuid
             */
            uom_id: string;
            /** Quantity */
            quantity: string;
            /** Estimated Unit Price */
            estimated_unit_price: string;
            /** Hsn Code */
            hsn_code?: string | null;
            /** Specifications */
            specifications?: string | null;
            /** Required By Date */
            required_by_date?: string | null;
            /** Delivery Location Id */
            delivery_location_id?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** RfqListResponse */
        RfqListResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /** Rfq Number */
            rfq_number: string;
            /** Title */
            title: string;
            /** Rfq Type */
            rfq_type: string;
            /** Status */
            status: string;
            /**
             * Buyer Id
             * Format: uuid
             */
            buyer_id: string;
            /**
             * Business Unit Id
             * Format: uuid
             */
            business_unit_id: string;
            /**
             * Category Id
             * Format: uuid
             */
            category_id: string;
            /** Currency */
            currency: string;
            /** Estimated Value */
            estimated_value: string;
            /** Bid Close At */
            bid_close_at?: string | null;
            /** Published At */
            published_at?: string | null;
            /** Bids Opened At */
            bids_opened_at?: string | null;
            /** Amendment Count */
            amendment_count: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** RfqLotCreateRequest */
        RfqLotCreateRequest: {
            /** Title */
            title: string;
            /** Description */
            description?: string | null;
            /**
             * Estimated Value
             * @default 0.0
             */
            estimated_value: number | string;
            /** Payment Term Override Id */
            payment_term_override_id?: string | null;
            /** Incoterm Override Id */
            incoterm_override_id?: string | null;
        };
        /** RfqLotResponse */
        RfqLotResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /** Lot Number */
            lot_number: number;
            /** Title */
            title: string;
            /** Description */
            description?: string | null;
            /** Estimated Value */
            estimated_value: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** RfqParticipantResponse */
        RfqParticipantResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /**
             * Vendor Id
             * Format: uuid
             */
            vendor_id: string;
            /**
             * Invited At
             * Format: date-time
             */
            invited_at: string;
            /** Invitation Status */
            invitation_status: string;
            /** Accepted At */
            accepted_at?: string | null;
            /** Regretted At */
            regretted_at?: string | null;
        };
        /** RfqUpdateRequest */
        RfqUpdateRequest: {
            /** Title */
            title?: string | null;
            /** Description */
            description?: string | null;
            /** Rfq Type */
            rfq_type?: string | null;
            /** Sourcing Type */
            sourcing_type?: string | null;
            /** Evaluation Type */
            evaluation_type?: string | null;
            /** Estimated Value */
            estimated_value?: number | string | null;
            /** Bid Close At */
            bid_close_at?: string | null;
            /** Bid Open At */
            bid_open_at?: string | null;
            /** Bid Validity Days */
            bid_validity_days?: number | null;
            /** Lots */
            lots?: components["schemas"]["RfqLotCreateRequest"][] | null;
            /** Lines */
            lines?: components["schemas"]["RfqLineCreateRequest"][] | null;
        };
        /** ScheduledJobRunResponse */
        ScheduledJobRunResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Org Id */
            org_id?: string | null;
            /** Job Name */
            job_name: string;
            /**
             * Started At
             * Format: date-time
             */
            started_at: string;
            /** Completed At */
            completed_at?: string | null;
            /** Status */
            status: string;
            /**
             * Records Processed
             * @default 0
             */
            records_processed: number;
            /** Error Message */
            error_message?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** SetProxyFloorRequest */
        SetProxyFloorRequest: {
            /** Lot Id */
            lot_id?: string | null;
            /** Floor Amount Inr */
            floor_amount_inr: number | string;
        };
        /** ShortlistResponse */
        ShortlistResponse: {
            /**
             * Cs Id
             * Format: uuid
             */
            cs_id: string;
            /** Shortlisted Vendor Ids */
            shortlisted_vendor_ids: string[];
            /** Message */
            message: string;
        };
        /** ShortlistVendorsRequest */
        ShortlistVendorsRequest: {
            /**
             * Vendor Ids
             * @description Vendors to shortlist for negotiation or award
             */
            vendor_ids: string[];
            /**
             * Criteria
             * @description Shortlisting rationale or filter (e.g. TOP_3, L1_AND_L2)
             */
            criteria?: string | null;
        };
        /** SimulateRequest */
        SimulateRequest: {
            /** Template Code */
            template_code: string;
            /** Entity Context */
            entity_context?: {
                [key: string]: unknown;
            };
        };
        /** SingleVendorCheckResponse */
        SingleVendorCheckResponse: {
            /**
             * Rfq Id
             * Format: uuid
             */
            rfq_id: string;
            /** Is Single Vendor */
            is_single_vendor: boolean;
            /** Bid Count */
            bid_count: number;
            /** Requires Override */
            requires_override: boolean;
        };
        /** SyncTriggerRequest */
        SyncTriggerRequest: {
            /**
             * Adapter Type
             * @default SAP
             */
            adapter_type: string;
            /** Entity Type */
            entity_type?: string | null;
        };
        /** SyncTriggerResponse */
        SyncTriggerResponse: {
            /** Status */
            status: string;
            /** Adapter Type */
            adapter_type: string;
            /** Jobs Created */
            jobs_created: number;
            /** Records Processed */
            records_processed: number;
            /** Message */
            message: string;
            /** Job Run Id */
            job_run_id?: string | null;
        };
        /** TaskActionRequest */
        TaskActionRequest: {
            /**
             * Comment
             * @default
             */
            comment: string;
        };
        /**
         * TaxCreateRequest
         * @description Validated payload for creating a new TaxCode.
         */
        TaxCreateRequest: {
            /** Code */
            code: string;
            /** Name */
            name: string;
            /** Rate */
            rate: number | string;
            /** Tax Type */
            tax_type: string;
            /** Hsn Chapter */
            hsn_chapter?: string | null;
        };
        /**
         * TaxUpdateRequest
         * @description Validated payload for updating an existing TaxCode. All fields optional.
         */
        TaxUpdateRequest: {
            /** Name */
            name?: string | null;
            /** Rate */
            rate?: number | string | null;
            /** Tax Type */
            tax_type?: string | null;
            /** Hsn Chapter */
            hsn_chapter?: string | null;
        };
        /** UnmappedPRDashboardResponse */
        UnmappedPRDashboardResponse: {
            /** Total Pending */
            total_pending: number;
            /** Tier 1 Count */
            tier_1_count: number;
            /** Tier 2 Count */
            tier_2_count: number;
            /** Tier 3 Count */
            tier_3_count: number;
            /** Tier 4 Count */
            tier_4_count: number;
            /** Total Blocked Value */
            total_blocked_value: string;
        };
        /** UnmappedPRExceptionResponse */
        UnmappedPRExceptionResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Org Id
             * Format: uuid
             */
            org_id: string;
            /**
             * Requisition Id
             * Format: uuid
             */
            requisition_id: string;
            /** Failed Fields */
            failed_fields: {
                [key: string]: unknown;
            } | unknown[];
            /** Status */
            status: string;
            /** Assigned To */
            assigned_to?: string | null;
            /** Sla Deadline */
            sla_deadline?: string | null;
            /** Sla Breach Level */
            sla_breach_level: number;
            /** Proposed Mappings */
            proposed_mappings?: {
                [key: string]: unknown;
            } | unknown[] | null;
            /** Resolution Notes */
            resolution_notes?: string | null;
            /** Resolved At */
            resolved_at?: string | null;
            /** Resolved By */
            resolved_by?: string | null;
            /** Reprocessing Attempts */
            reprocessing_attempts: number;
            /** Last Reprocessing Error */
            last_reprocessing_error?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
            requisition?: components["schemas"]["PRListResponse"] | null;
        };
        /** UnmappedPRMapRequest */
        UnmappedPRMapRequest: {
            /** Mappings */
            mappings: components["schemas"]["UnmappedPRMappingItem"][];
            /** Notes */
            notes?: string | null;
        };
        /** UnmappedPRMappingItem */
        UnmappedPRMappingItem: {
            /** Field */
            field: string;
            /**
             * Value
             * Format: uuid
             */
            value: string;
            /** Source Value */
            source_value?: string | null;
            /** Label */
            label?: string | null;
        };
        /** UnmappedPRSuggestionResponse */
        UnmappedPRSuggestionResponse: {
            /**
             * Exception Id
             * Format: uuid
             */
            exception_id: string;
            /** Suggested Category Id */
            suggested_category_id?: string | null;
            /** Confidence */
            confidence: number;
            /** Auto Apply */
            auto_apply: boolean;
            /** Based On Records */
            based_on_records: number;
            /** Suggestions */
            suggestions?: components["schemas"]["MappingSuggestionItem"][];
            /** Reason */
            reason?: string | null;
        };
        /**
         * UomCreateRequest
         * @description Validated payload for creating a new Unit of Measure.
         */
        UomCreateRequest: {
            /**
             * Code
             * @description Unique UoM code within the organisation.
             */
            code: string;
            /**
             * Name
             * @description Human-readable name of the UoM.
             */
            name: string;
            /**
             * Iso Code
             * @description ISO 80000 or similar standard code.
             */
            iso_code?: string | null;
        };
        /**
         * UomUpdateRequest
         * @description Validated payload for updating an existing Unit of Measure.
         *
         *     All fields are optional; only supplied fields are applied.
         */
        UomUpdateRequest: {
            /** Name */
            name?: string | null;
            /** Iso Code */
            iso_code?: string | null;
            /** Is Active */
            is_active?: boolean | null;
        };
        /** UserCreateRequest */
        UserCreateRequest: {
            /**
             * Email
             * Format: email
             */
            email: string;
            /** First Name */
            first_name: string;
            /** Last Name */
            last_name: string;
            /** Password */
            password: string;
            /** Employee Id */
            employee_id?: string | null;
            /** Roles */
            roles?: string[] | null;
        };
        /** UserUpdateRequest */
        UserUpdateRequest: {
            /** First Name */
            first_name?: string | null;
            /** Last Name */
            last_name?: string | null;
            /** Phone */
            phone?: string | null;
            /** Language */
            language?: string | null;
            /** Timezone */
            timezone?: string | null;
            /** Roles */
            roles?: string[] | null;
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input?: unknown;
            /** Context */
            ctx?: Record<string, never>;
        };
        /** VendorBankAccountCreateRequest */
        VendorBankAccountCreateRequest: {
            /** Account Holder Name */
            account_holder_name: string;
            /** Bank Name */
            bank_name: string;
            /** Branch Name */
            branch_name?: string | null;
            /** Account Number */
            account_number: string;
            /** Ifsc Code */
            ifsc_code: string;
            /** Swift Code */
            swift_code?: string | null;
            /**
             * Is Primary
             * @default false
             */
            is_primary: boolean;
        };
        /** VendorBlacklistConfirmRequest */
        VendorBlacklistConfirmRequest: {
            /** Workflow Task Id */
            workflow_task_id?: string | null;
            /** Reason */
            reason?: string | null;
        };
        /** VendorBlacklistInitiateRequest */
        VendorBlacklistInitiateRequest: {
            /** Reason */
            reason: string;
        };
        /** VendorCategoriesUpdateRequest */
        VendorCategoriesUpdateRequest: {
            /** Category Ids */
            category_ids: string[];
        };
        /** VendorContactCreateRequest */
        VendorContactCreateRequest: {
            /** Name */
            name: string;
            /** Designation */
            designation?: string | null;
            /**
             * Email
             * Format: email
             */
            email: string;
            /** Phone */
            phone?: string | null;
            /**
             * Is Primary
             * @default false
             */
            is_primary: boolean;
        };
        /** VendorDocumentCreateRequest */
        VendorDocumentCreateRequest: {
            /**
             * Document Id
             * Format: uuid
             */
            document_id: string;
            /**
             * Document Type Id
             * Format: uuid
             */
            document_type_id: string;
            /** Expiry Date */
            expiry_date?: string | null;
            /** Verification Notes */
            verification_notes?: string | null;
        };
        /** VendorInviteRequest */
        VendorInviteRequest: {
            /** Company Name */
            company_name: string;
            /**
             * Primary Email
             * Format: email
             */
            primary_email: string;
            /** Primary Phone */
            primary_phone?: string | null;
            /** Category Ids */
            category_ids?: string[];
            /** Invited Note */
            invited_note?: string | null;
        };
        /** VendorQualifyRequest */
        VendorQualifyRequest: {
            /** Notes */
            notes?: string | null;
        };
        /** VendorRegistrationRequest */
        VendorRegistrationRequest: {
            /** Company Name */
            company_name?: string | null;
            /** Legal Name */
            legal_name?: string | null;
            /** Pan */
            pan?: string | null;
            /** Gstin */
            gstin?: string | null;
            /** Cin */
            cin?: string | null;
            /** Duns Number */
            duns_number?: string | null;
            /** Website */
            website?: string | null;
            /** Primary Phone */
            primary_phone?: string | null;
            /** Address Line1 */
            address_line1?: string | null;
            /** Address Line2 */
            address_line2?: string | null;
            /** City */
            city?: string | null;
            /** State */
            state?: string | null;
            /** Postal Code */
            postal_code?: string | null;
            /**
             * Country Code
             * @default IN
             */
            country_code: string;
            /** Category Ids */
            category_ids?: string[];
            /** Contacts */
            contacts?: components["schemas"]["VendorContactCreateRequest"][];
            /** Bank Accounts */
            bank_accounts?: components["schemas"]["VendorBankAccountCreateRequest"][];
        };
        /** VendorReinstateRequest */
        VendorReinstateRequest: {
            /** Reason */
            reason?: string | null;
        };
        /** VendorRejectRequest */
        VendorRejectRequest: {
            /** Reason */
            reason: string;
        };
        /** VendorResubmissionRequest */
        VendorResubmissionRequest: {
            /** Reason */
            reason: string;
        };
        /** VendorScorecardUpdateRequest */
        VendorScorecardUpdateRequest: {
            /** Period Start */
            period_start?: string | null;
            /** Period End */
            period_end?: string | null;
            /** On Time Delivery Rate */
            on_time_delivery_rate?: number | string | null;
            /** Quality Acceptance Rate */
            quality_acceptance_rate?: number | string | null;
            /** Commercial Compliance Score */
            commercial_compliance_score?: number | string | null;
            /** Responsiveness Score */
            responsiveness_score?: number | string | null;
        };
        /** VendorSubmitRequest */
        VendorSubmitRequest: {
            /** Notes */
            notes?: string | null;
        };
        /** VendorSuspendRequest */
        VendorSuspendRequest: {
            /** Reason */
            reason: string;
        };
        /** VendorUpdateRequest */
        VendorUpdateRequest: {
            /** Company Name */
            company_name?: string | null;
            /** Legal Name */
            legal_name?: string | null;
            /** Pan */
            pan?: string | null;
            /** Gstin */
            gstin?: string | null;
            /** Cin */
            cin?: string | null;
            /** Duns Number */
            duns_number?: string | null;
            /** Website */
            website?: string | null;
            /** Primary Phone */
            primary_phone?: string | null;
            /** Address Line1 */
            address_line1?: string | null;
            /** Address Line2 */
            address_line2?: string | null;
            /** City */
            city?: string | null;
            /** State */
            state?: string | null;
            /** Postal Code */
            postal_code?: string | null;
            /** Country Code */
            country_code?: string | null;
            /** Onboarding Step */
            onboarding_step?: number | null;
        };
        /** WorkflowTemplateCreateRequest */
        WorkflowTemplateCreateRequest: {
            /** Code */
            code: string;
            /** Name */
            name: string;
            /** Entity Type */
            entity_type: string;
            /** Steps */
            steps: {
                [key: string]: unknown;
            }[];
            /**
             * Is Active
             * @default true
             */
            is_active: boolean;
        };
        /** WorkflowTemplateUpdateRequest */
        WorkflowTemplateUpdateRequest: {
            /** Name */
            name?: string | null;
            /** Steps */
            steps?: {
                [key: string]: unknown;
            }[] | null;
            /** Is Active */
            is_active?: boolean | null;
        };
        /** CancelRequest */
        app__modules__sourcing__schemas__CancelRequest: {
            /** Reason */
            reason: string;
        };
        /** CancelRequest */
        app__modules__workflow__schemas__CancelRequest: {
            /** Reason */
            reason: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    metrics_metrics_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    health_check_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    health_ready_health_ready_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    health_live_health_live_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    health_api_v1_organizations_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    health_api_v1_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    list_business_units_api_v1_organizations_business_units_get: {
        parameters: {
            query?: {
                active_only?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_BusinessUnitResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_business_units_api_v1_business_units_get: {
        parameters: {
            query?: {
                active_only?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_BusinessUnitResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_cost_centers_api_v1_organizations_cost_centers_get: {
        parameters: {
            query?: {
                business_unit_id?: string | null;
                active_only?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_CostCenterResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_cost_centers_api_v1_cost_centers_get: {
        parameters: {
            query?: {
                business_unit_id?: string | null;
                active_only?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_CostCenterResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_me_api_v1_users_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    get_my_permissions_api_v1_users_me_permissions_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    change_my_password_api_v1_users_me_password_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangePasswordRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_users_api_v1_users__get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    create_user_api_v1_users__post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_roles_api_v1_users_roles_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    assign_user_role_api_v1_users__user_id__roles_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AssignRoleRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    remove_user_role_api_v1_users__user_id__roles__role_code__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
                role_code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_user_api_v1_users__user_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_user_api_v1_users__user_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    activate_user_api_v1_users__user_id__activate_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    deactivate_user_api_v1_users__user_id__deactivate_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                user_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_categories_api_v1_master_data_categories_get: {
        parameters: {
            query?: {
                /** @description If false, returns nested tree structure */
                flat?: boolean;
                active_only?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_category_api_v1_master_data_categories_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CategoryCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_category_tree_api_v1_master_data_categories_tree_get: {
        parameters: {
            query?: {
                /** @description Optional root category to scope tree to */
                root_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_category_api_v1_master_data_categories__id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CategoryUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_category_api_v1_master_data_categories__id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_uoms_api_v1_master_data_uoms_get: {
        parameters: {
            query?: {
                active_only?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_uom_api_v1_master_data_uoms_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UomCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_uoms_api_v1_master_data_uom_get: {
        parameters: {
            query?: {
                active_only?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_uom_api_v1_master_data_uoms__id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UomUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_uom_api_v1_master_data_uoms__id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_currencies_api_v1_master_data_currencies_get: {
        parameters: {
            query?: {
                include_rates?: boolean;
                active_only?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_currency_api_v1_master_data_currencies_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CurrencyCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_currency_api_v1_master_data_currencies__id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CurrencyUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_currency_api_v1_master_data_currencies__id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_payment_terms_api_v1_master_data_payment_terms_get: {
        parameters: {
            query?: {
                active_only?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_payment_term_api_v1_master_data_payment_terms_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PaymentTermCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_payment_term_api_v1_master_data_payment_terms__id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PaymentTermUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_payment_term_api_v1_master_data_payment_terms__id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_incoterms_api_v1_master_data_incoterms_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    list_tax_codes_api_v1_master_data_tax_codes_get: {
        parameters: {
            query?: {
                /** @description Optional filter by GST/TDS/CESS */
                tax_type?: string | null;
                active_only?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_tax_code_api_v1_master_data_tax_codes_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaxCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_tax_code_api_v1_master_data_tax_codes__id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaxUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_tax_code_api_v1_master_data_tax_codes__id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_delivery_locations_api_v1_master_data_delivery_locations_get: {
        parameters: {
            query?: {
                active_only?: boolean;
                country_code?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_delivery_location_api_v1_master_data_delivery_locations_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocationCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_delivery_location_api_v1_master_data_delivery_locations__id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LocationUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_delivery_location_api_v1_master_data_delivery_locations__id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_holidays_by_year_api_v1_master_data_holidays__year__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                year: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_holiday_api_v1_master_data_holidays_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HolidayCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_holiday_api_v1_master_data_holidays__id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    import_categories_api_v1_master_data_import_categories_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_import_categories_api_v1_master_data_import_categories_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_import_status_api_v1_master_data_import_categories__job_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_api_v1_master_data_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    validate_invitation_token_api_v1_vendors_invitation__token__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    register_vendor_with_token_api_v1_vendors_register__token__post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorRegistrationRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    invite_vendor_api_v1_vendors_invite_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorInviteRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_vendors_api_v1_vendors_get: {
        parameters: {
            query?: {
                status?: string | null;
                category_id?: string | null;
                search?: string | null;
                page?: number;
                page_size?: number;
                sort_by?: string;
                sort_dir?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_vendors_csv_api_v1_vendors_export_csv_get: {
        parameters: {
            query?: {
                status?: string | null;
                category_id?: string | null;
                search?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_vendors_pdf_api_v1_vendors_export_pdf_get: {
        parameters: {
            query?: {
                status?: string | null;
                category_id?: string | null;
                search?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    check_duplicates_api_v1_vendors_check_duplicates_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DuplicateCheckRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    bulk_category_mapping_api_v1_vendors_bulk_category_mapping_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BulkVendorCategoryMappingRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_my_vendor_profile_api_v1_vendors_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    update_my_vendor_profile_api_v1_vendors_me_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_my_vendor_documents_api_v1_vendors_me_documents_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    add_my_vendor_document_api_v1_vendors_me_documents_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorDocumentCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_vendor_detail_api_v1_vendors__id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_vendor_api_v1_vendors__id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    submit_vendor_api_v1_vendors__id__submit_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["VendorSubmitRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    qualify_vendor_api_v1_vendors__id__qualify_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["VendorQualifyRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    activate_vendor_api_v1_vendors__id__activate_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reject_vendor_api_v1_vendors__id__reject_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorRejectRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    request_resubmission_api_v1_vendors__id__request_resubmission_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorResubmissionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    suspend_vendor_api_v1_vendors__id__suspend_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorSuspendRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reinstate_vendor_api_v1_vendors__id__reinstate_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["VendorReinstateRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    initiate_blacklist_api_v1_vendors__id__initiate_blacklist_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorBlacklistInitiateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    confirm_blacklist_api_v1_vendors__id__confirm_blacklist_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["VendorBlacklistConfirmRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_vendor_scorecard_api_v1_vendors__id__scorecard_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_vendor_scorecard_api_v1_vendors__id__scorecard_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["VendorScorecardUpdateRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_vendor_documents_api_v1_vendors__id__documents_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_vendor_document_api_v1_vendors__id__documents_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorDocumentCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_vendor_categories_api_v1_vendors__id__categories_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorCategoriesUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_bank_account_api_v1_vendors__id__bank_accounts_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VendorBankAccountCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    initiate_penny_test_api_v1_vendors__id__bank_accounts__bank_id__initiate_penny_test_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                bank_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    confirm_penny_test_api_v1_vendors__id__bank_accounts__bank_id__confirm_penny_test_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                bank_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PennyTestConfirmRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_requisitions_api_v1_requisitions_get: {
        parameters: {
            query?: {
                status?: string | null;
                business_unit_id?: string | null;
                category_id?: string | null;
                requestor_id?: string | null;
                search?: string | null;
                scope?: string;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_PRListResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_requisition_api_v1_requisitions_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PRCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    bulk_create_requisitions_api_v1_requisitions_bulk_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PRBulkCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_PRDetailResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_requisitions_csv_api_v1_requisitions_export_csv_get: {
        parameters: {
            query?: {
                status?: string | null;
                business_unit_id?: string | null;
                category_id?: string | null;
                requestor_id?: string | null;
                search?: string | null;
                scope?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_requisitions_pdf_api_v1_requisitions_export_pdf_get: {
        parameters: {
            query?: {
                status?: string | null;
                business_unit_id?: string | null;
                category_id?: string | null;
                requestor_id?: string | null;
                search?: string | null;
                scope?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_requisition_api_v1_requisitions__id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_requisition_api_v1_requisitions__id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PRUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    submit_requisition_api_v1_requisitions__id__submit_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    withdraw_requisition_api_v1_requisitions__id__withdraw_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    amend_requisition_api_v1_requisitions__id__amend_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PRUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    merge_requisitions_api_v1_requisitions_merge_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PRMergeRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    split_requisition_api_v1_requisitions__id__split_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PRSplitRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_PRDetailResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    convert_to_rfq_api_v1_requisitions__id__convert_to_rfq_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    convert_to_po_api_v1_requisitions__id__convert_to_po_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_pr_audit_trail_api_v1_requisitions__id__audit_trail_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_dict__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    approve_requisition_api_v1_requisitions__id__approve_post: {
        parameters: {
            query?: {
                task_id?: string | null;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["PRApprovalAction"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reject_requisition_api_v1_requisitions__id__reject_post: {
        parameters: {
            query?: {
                task_id?: string | null;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PRApprovalAction"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_unmapped_prs_api_v1_unmapped_prs_get: {
        parameters: {
            query?: {
                status?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_UnmappedPRExceptionResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_unmapped_pr_dashboard_api_v1_unmapped_prs_dashboard_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_UnmappedPRDashboardResponse_"];
                };
            };
        };
    };
    map_unmapped_pr_api_v1_unmapped_prs__id__map_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UnmappedPRMapRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_mapping_suggestions_api_v1_unmapped_prs__id__suggest_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_UnmappedPRSuggestionResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    auto_map_pr_api_v1_unmapped_prs__id__auto_map_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PRDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_rfqs_api_v1_rfqs_get: {
        parameters: {
            query?: {
                status?: string | null;
                rfq_type?: string | null;
                business_unit_id?: string | null;
                category_id?: string | null;
                search?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_RfqListResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_rfq_api_v1_rfqs_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RfqCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_rfqs_csv_api_v1_rfqs_export_csv_get: {
        parameters: {
            query?: {
                status?: string | null;
                rfq_type?: string | null;
                business_unit_id?: string | null;
                category_id?: string | null;
                search?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_rfqs_pdf_api_v1_rfqs_export_pdf_get: {
        parameters: {
            query?: {
                status?: string | null;
                rfq_type?: string | null;
                business_unit_id?: string | null;
                category_id?: string | null;
                search?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_rfq_api_v1_rfqs__id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_rfq_api_v1_rfqs__id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RfqUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    submit_rfq_api_v1_rfqs__id__submit_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    publish_rfq_api_v1_rfqs__id__publish_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    amend_rfq_api_v1_rfqs__id__amend_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AmendRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    cancel_rfq_api_v1_rfqs__id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["app__modules__sourcing__schemas__CancelRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    extend_deadline_api_v1_rfqs__id__extend_deadline_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExtendDeadlineRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_participants_api_v1_rfqs__id__add_participants_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AddParticipantsRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_RfqParticipantResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    remove_participant_api_v1_rfqs__id__participants__vendor_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                vendor_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    initiate_bid_opening_api_v1_rfqs__id__initiate_bid_opening_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    co_authorize_bid_opening_api_v1_rfqs__id__co_authorize_opening_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_clarifications_api_v1_rfqs__id__clarifications_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_RfqClarificationResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_clarification_api_v1_rfqs__id__clarifications_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClarificationCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqClarificationResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    respond_to_clarification_api_v1_rfqs__id__clarifications__cid__respond_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                cid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClarificationRespondRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqClarificationResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_rfq_audit_trail_api_v1_rfqs__id__audit_trail_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_dict__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_rfq_dashboard_api_v1_rfqs__id__dashboard_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDashboardResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_rfqs_api_v1_sourcing_get: {
        parameters: {
            query?: {
                status?: string | null;
                rfq_type?: string | null;
                business_unit_id?: string | null;
                category_id?: string | null;
                search?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_RfqListResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_rfq_api_v1_sourcing_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RfqCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_rfqs_csv_api_v1_sourcing_export_csv_get: {
        parameters: {
            query?: {
                status?: string | null;
                rfq_type?: string | null;
                business_unit_id?: string | null;
                category_id?: string | null;
                search?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_rfqs_pdf_api_v1_sourcing_export_pdf_get: {
        parameters: {
            query?: {
                status?: string | null;
                rfq_type?: string | null;
                business_unit_id?: string | null;
                category_id?: string | null;
                search?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_rfq_api_v1_sourcing__id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_rfq_api_v1_sourcing__id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RfqUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    submit_rfq_api_v1_sourcing__id__submit_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    publish_rfq_api_v1_sourcing__id__publish_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    amend_rfq_api_v1_sourcing__id__amend_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AmendRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    cancel_rfq_api_v1_sourcing__id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["app__modules__sourcing__schemas__CancelRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    extend_deadline_api_v1_sourcing__id__extend_deadline_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExtendDeadlineRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_participants_api_v1_sourcing__id__add_participants_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AddParticipantsRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_RfqParticipantResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    remove_participant_api_v1_sourcing__id__participants__vendor_id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                vendor_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    initiate_bid_opening_api_v1_sourcing__id__initiate_bid_opening_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    co_authorize_bid_opening_api_v1_sourcing__id__co_authorize_opening_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_clarifications_api_v1_sourcing__id__clarifications_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_RfqClarificationResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_clarification_api_v1_sourcing__id__clarifications_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClarificationCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqClarificationResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    respond_to_clarification_api_v1_sourcing__id__clarifications__cid__respond_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                cid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClarificationRespondRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqClarificationResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_rfq_audit_trail_api_v1_sourcing__id__audit_trail_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_dict__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_rfq_dashboard_api_v1_sourcing__id__dashboard_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RfqDashboardResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_bid_count_api_v1_rfqs__rfq_id__bid_count_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rfq_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_BidCountResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    revise_bid_api_v1_rfqs__rfq_id__bids_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rfq_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BidReviseRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_BidDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    submit_bid_api_v1_rfqs__rfq_id__bids_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rfq_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BidSubmitRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_BidDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    withdraw_bid_api_v1_rfqs__rfq_id__bids_delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rfq_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BidWithdrawRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_BidDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_bid_details_api_v1_bids__bid_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                bid_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_BidDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    single_vendor_check_api_v1_rfqs__rfq_id__single_vendor_check_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rfq_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_SingleVendorCheckResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_api_v1_evaluations_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    generate_comparative_statement_api_v1_evaluations_rfq__rfq_id__generate_cs_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rfq_id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["CSGenerateRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ComparativeStatementResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_latest_cs_for_rfq_api_v1_evaluations_rfq__rfq_id__cs_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rfq_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ComparativeStatementResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_cs_versions_api_v1_evaluations_rfq__rfq_id__cs_versions_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rfq_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_CSVersionSummaryResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_cs_by_id_api_v1_evaluations__cs_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                cs_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ComparativeStatementResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    shortlist_vendors_api_v1_evaluations__cs_id__shortlist_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                cs_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ShortlistVendorsRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ShortlistResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_negotiations_for_cs_api_v1_evaluations__cs_id__negotiations_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                cs_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_NegotiationResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    start_negotiation_api_v1_evaluations__cs_id__negotiations_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                cs_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NegotiationStartRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_NegotiationResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    submit_negotiated_price_api_v1_evaluations_negotiations__negotiation_id__submit_price_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                negotiation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NegotiatedPriceSubmitRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_NegotiationResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    recommend_award_api_v1_evaluations__cs_id__recommend_award_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                cs_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AwardRecommendRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_AwardRecommendationResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_award_recommendation_api_v1_evaluations__cs_id__award_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                cs_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_AwardRecommendationResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    approve_award_api_v1_evaluations_awards__arn_id__approve_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                arn_id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["AwardApprovalRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_AwardRecommendationResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    send_regret_letters_api_v1_evaluations__cs_id__send_regret_letters_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                cs_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_RegretLettersResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_api_v1_awards_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    health_api_v1_contracts_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    list_contracts_api_v1_contracts_get: {
        parameters: {
            query?: {
                status?: string | null;
                vendor_id?: string | null;
                category_id?: string | null;
                search?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_ContractListResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_contract_api_v1_contracts_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContractCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ContractResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_contract_from_award_api_v1_contracts_from_award__arn_id__post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                arn_id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["ContractFromAwardRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ContractResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_templates_api_v1_contracts_templates_get: {
        parameters: {
            query?: {
                contract_type?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_ContractTemplateResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_contract_detail_api_v1_contracts__contract_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contract_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ContractResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    initiate_esign_api_v1_contracts__contract_id__esign_initiate_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contract_id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["EsignInitiateRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_EsignInitiateResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    confirm_esign_api_v1_contracts__contract_id__esign_confirm_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contract_id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["EsignConfirmRequest"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ContractResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    esign_webhook_api_v1_contracts_esign_callback_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EsignWebhookPayload"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_dict_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    amend_contract_api_v1_contracts__contract_id__amend_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contract_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContractAmendRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ContractResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_contract_status_api_v1_contracts__contract_id__status_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contract_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContractStatusUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ContractResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    complete_milestone_api_v1_contracts__contract_id__milestones__milestone_id__complete_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contract_id: string;
                milestone_id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["ContractMilestoneUpdate"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ContractMilestoneResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_utilization_api_v1_contracts__contract_id__utilization_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                contract_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ContractUtilizationUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ContractResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_api_v1_purchase_orders_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    list_purchase_orders_api_v1_purchase_orders_get: {
        parameters: {
            query?: {
                status?: string | null;
                vendor_id?: string | null;
                business_unit_id?: string | null;
                rfq_id?: string | null;
                contract_id?: string | null;
                search?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_POResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_purchase_order_api_v1_purchase_orders_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["POCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_POResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_from_award_api_v1_purchase_orders_from_award_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["POFromAwardRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_POResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_purchase_order_api_v1_purchase_orders__po_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                po_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_POResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    approve_purchase_order_api_v1_purchase_orders__po_id__approve_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                po_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_POResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reject_purchase_order_api_v1_purchase_orders__po_id__reject_post: {
        parameters: {
            query: {
                rejection_reason: string;
            };
            header?: never;
            path: {
                po_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_POResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    send_to_vendor_api_v1_purchase_orders__po_id__send_to_vendor_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                po_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_POResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    acknowledge_purchase_order_api_v1_purchase_orders__po_id__acknowledge_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                po_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["POAcknowledgeRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_POResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    amend_purchase_order_api_v1_purchase_orders__po_id__amend_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                po_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["POAmendRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_POResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    close_purchase_order_api_v1_purchase_orders__po_id__close_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                po_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_POResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    cancel_purchase_order_api_v1_purchase_orders__po_id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                po_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["POCancelRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_POResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    download_po_pdf_api_v1_purchase_orders__po_id__pdf_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                po_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_api_v1_grn_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    list_grns_api_v1_grn_get: {
        parameters: {
            query?: {
                po_id?: string | null;
                status?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_GrnResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_grn_api_v1_grn_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GrnCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_GrnResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_grn_api_v1_grn__grn_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grn_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_GrnResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    record_quality_inspection_api_v1_grn_inspections_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["QualityInspectionCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_QualityInspectionResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    confirm_grn_api_v1_grn__grn_id__confirm_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                grn_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_GrnResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    cancel_grn_api_v1_grn__grn_id__cancel_post: {
        parameters: {
            query: {
                reason: string;
            };
            header?: never;
            path: {
                grn_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_GrnResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_api_v1_invoices_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    list_invoices_api_v1_invoices_get: {
        parameters: {
            query?: {
                po_id?: string | null;
                vendor_id?: string | null;
                status?: string | null;
                match_status?: string | null;
                payment_status?: string | null;
                financial_year?: string | null;
                search?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_InvoiceResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    submit_invoice_api_v1_invoices_post: {
        parameters: {
            query?: {
                vendor_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvoiceSubmitRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_InvoiceResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_invoices_csv_api_v1_invoices_export_csv_get: {
        parameters: {
            query?: {
                po_id?: string | null;
                vendor_id?: string | null;
                status?: string | null;
                match_status?: string | null;
                payment_status?: string | null;
                financial_year?: string | null;
                search?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_invoices_pdf_api_v1_invoices_export_pdf_get: {
        parameters: {
            query?: {
                po_id?: string | null;
                vendor_id?: string | null;
                status?: string | null;
                match_status?: string | null;
                payment_status?: string | null;
                financial_year?: string | null;
                search?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_eligible_lines_api_v1_invoices_eligible_lines_get: {
        parameters: {
            query?: {
                vendor_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_EligibleLineResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_invoice_api_v1_invoices__invoice_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                invoice_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_InvoiceResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    match_invoice_api_v1_invoices__invoice_id__match_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                invoice_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_InvoiceResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    approve_invoice_api_v1_invoices__invoice_id__approve_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                invoice_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_InvoiceResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reject_invoice_api_v1_invoices__invoice_id__reject_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                invoice_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvoiceRejectRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_InvoiceResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    dispute_invoice_api_v1_invoices__invoice_id__dispute_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                invoice_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvoiceDisputeRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_InvoiceResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_api_v1_payments_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    list_payments_api_v1_payments_get: {
        parameters: {
            query?: {
                invoice_id?: string | null;
                vendor_id?: string | null;
                status?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_PaymentRecordResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    schedule_payment_api_v1_payments_schedule_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PaymentScheduleRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PaymentRecordResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_payment_api_v1_payments__payment_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                payment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PaymentRecordResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    download_remittance_pdf_api_v1_payments__payment_id__remittance_pdf_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                payment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    process_payment_api_v1_payments__payment_id__process_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                payment_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PaymentProcessRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_PaymentRecordResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    erp_payment_webhook_api_v1_payments_webhook_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ErpPaymentWebhookRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_disputes_api_v1_payments_disputes_all_get: {
        parameters: {
            query?: {
                invoice_id?: string | null;
                status?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_DisputeResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_dispute_api_v1_payments_disputes_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DisputeCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_DisputeResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    add_dispute_message_api_v1_payments_disputes__dispute_id__messages_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                dispute_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DisputeMessageCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_DisputeMessageResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    resolve_dispute_api_v1_payments_disputes__dispute_id__resolve_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                dispute_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DisputeResolveRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_DisputeResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_notifications_api_v1_notifications_get: {
        parameters: {
            query?: {
                /** @description Page number */
                page?: number;
                /** @description Page size */
                page_size?: number;
                /** @description Filter unread only */
                unread_only?: boolean;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    mark_notification_read_api_v1_notifications__notification_id__read_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                notification_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    mark_all_notifications_read_api_v1_notifications_mark_all_read_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    get_notification_preferences_api_v1_notifications_preferences_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    update_notification_preferences_api_v1_notifications_preferences_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NotificationPreferencesUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_api_v1_documents_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    upload_document_api_v1_documents_upload_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_document_api_v1_documents_upload_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_document_presigned_url_api_v1_documents__id__presigned_url_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_document_versions_api_v1_documents__id__versions_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_document_api_v1_documents__id__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_entity_documents_api_v1_documents_entity__entity_type___entity_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                entity_type: string;
                entity_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_instance_api_v1_workflows_instances__instance_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                instance_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_my_tasks_api_v1_workflows_tasks_my_get: {
        parameters: {
            query?: {
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    approve_task_api_v1_workflows_instances__instance_id__tasks__task_id__approve_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                instance_id: string;
                task_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaskActionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    reject_task_api_v1_workflows_instances__instance_id__tasks__task_id__reject_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                instance_id: string;
                task_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaskActionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    return_task_api_v1_workflows_instances__instance_id__tasks__task_id__return_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                instance_id: string;
                task_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TaskActionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    cancel_instance_api_v1_workflows_instances__instance_id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                instance_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["app__modules__workflow__schemas__CancelRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    pause_instance_api_v1_workflows_instances__instance_id__pause_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                instance_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    resume_instance_api_v1_workflows_instances__instance_id__resume_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                instance_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    force_advance_api_v1_workflows_instances__instance_id__force_advance_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                instance_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ForceAdvanceRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    simulate_api_v1_workflows_simulate_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SimulateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_templates_api_v1_workflows_templates_get: {
        parameters: {
            query?: {
                entity_type?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_template_api_v1_workflows_templates_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkflowTemplateCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_template_detail_api_v1_workflows_templates__template_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_template_api_v1_workflows_templates__template_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                template_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkflowTemplateUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_rules_api_v1_approval_rules_get: {
        parameters: {
            query?: {
                entity_type?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_rule_api_v1_approval_rules_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApprovalRuleCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_rule_api_v1_approval_rules__rule_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rule_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    update_rule_api_v1_approval_rules__rule_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rule_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApprovalRuleUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    activate_rule_api_v1_approval_rules__rule_id__activate_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rule_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    deactivate_rule_api_v1_approval_rules__rule_id__deactivate_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rule_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_rule_versions_api_v1_approval_rules__rule_id__versions_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rule_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    simulate_rule_matching_api_v1_approval_rules_simulate_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ApprovalRuleSimulateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_integration_stats_api_v1_integrations_stats_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_IntegrationStatsResponse_"];
                };
            };
        };
    };
    list_integration_jobs_api_v1_integrations_jobs_get: {
        parameters: {
            query?: {
                /** @description Filter by job status (e.g. FAILED, COMPLETED, PENDING) */
                status?: string | null;
                /** @description Filter by job type */
                job_type?: string | null;
                /** @description Filter by adapter (e.g. SAP, ORACLE, WORKDAY, DIGIO) */
                adapter_type?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_IntegrationJobResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_integration_job_detail_api_v1_integrations_jobs__job_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_IntegrationJobResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    retry_integration_job_api_v1_integrations_jobs__job_id__retry_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_IntegrationJobResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_scheduled_runs_api_v1_integrations_scheduled_runs_get: {
        parameters: {
            query?: {
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_List_ScheduledJobRunResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    trigger_erp_sync_api_v1_integrations_sync_trigger_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["SyncTriggerRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_SyncTriggerResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_integration_config_api_v1_integrations_config_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ERPConfigResponse_"];
                };
            };
        };
    };
    update_integration_config_api_v1_integrations_config_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ERPConfigUpdateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_ERPConfigResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_api_v1_analytics_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    get_dashboard_api_v1_analytics_dashboard_get: {
        parameters: {
            query?: {
                fiscal_year?: string | null;
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_spend_api_v1_analytics_spend_get: {
        parameters: {
            query?: {
                /** @description category, vendor, bu, or all */
                group_by?: string | null;
                fiscal_year?: string | null;
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_savings_api_v1_analytics_savings_get: {
        parameters: {
            query?: {
                fiscal_year?: string | null;
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_cycle_times_api_v1_analytics_cycle_times_get: {
        parameters: {
            query?: {
                fiscal_year?: string | null;
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_all_vendor_performance_api_v1_analytics_vendor_performance_get: {
        parameters: {
            query?: {
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_single_vendor_performance_api_v1_analytics_vendor_performance__vendor_id__get: {
        parameters: {
            query?: {
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path: {
                vendor_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_sla_compliance_api_v1_analytics_sla_compliance_get: {
        parameters: {
            query?: {
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_compliance_api_v1_analytics_compliance_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    get_unmapped_prs_api_v1_analytics_unmapped_prs_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    get_invoices_api_v1_analytics_invoices_get: {
        parameters: {
            query?: {
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_export_csv_api_v1_analytics_export_csv_get: {
        parameters: {
            query?: {
                /** @description spend, vendors, or kpis */
                report_type?: string | null;
                fiscal_year?: string | null;
                group_by?: string | null;
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_csv_api_v1_analytics_export_csv_post: {
        parameters: {
            query?: {
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExportRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_export_pdf_api_v1_analytics_export_pdf_get: {
        parameters: {
            query?: {
                /** @description spend, vendors, or kpis */
                report_type?: string | null;
                fiscal_year?: string | null;
                group_by?: string | null;
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    export_excel_api_v1_analytics_export_excel_post: {
        parameters: {
            query?: {
                /** @description Optional Business Unit filter */
                business_unit_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExportRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    health_api_v1_admin_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    get_audit_logs_api_v1_admin_audit_logs_get: {
        parameters: {
            query?: {
                /** @description Entity type filter */
                entity_type?: string | null;
                /** @description Action filter */
                action?: string | null;
                /** @description Actor user ID */
                actor_id?: string | null;
                /** @description Actor email */
                actor_email?: string | null;
                /** @description Entity ID */
                entity_id?: string | null;
                /** @description Start date filter */
                date_from?: string | null;
                /** @description End date filter */
                date_to?: string | null;
                /** @description Full-text search query */
                search?: string | null;
                /** @description Page number */
                page?: number;
                /** @description Items per page */
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_list_dict__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    login_api_v1_auth_login_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    refresh_api_v1_auth_refresh_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    logout_api_v1_auth_logout_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    verify_mfa_api_v1_auth_mfa_verify_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MFAVerifyRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    enroll_mfa_api_v1_auth_mfa_enroll_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    confirm_mfa_api_v1_auth_mfa_confirm_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MFAConfirmRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    sso_initiate_api_v1_auth_sso_initiate_get: {
        parameters: {
            query: {
                provider: string;
                org_id: string;
                portal?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    sso_callback_api_v1_auth_sso_callback_post: {
        parameters: {
            query?: {
                state?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    oidc_callback_api_v1_auth_sso_oidc_callback_get: {
        parameters: {
            query: {
                code: string;
                state: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_auction_state_api_v1_rfqs__rfq_id__auction_state_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rfq_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    place_auction_bid_api_v1_rfqs__rfq_id__auction_bid_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rfq_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AuctionBidRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    list_auctions_api_v1_auctions_get: {
        parameters: {
            query?: {
                rfq_id?: string | null;
                status?: string | null;
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_list_LiveAuctionDetailResponse__"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    create_auction_api_v1_auctions_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AuctionCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_LiveAuctionDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_auction_api_v1_auctions__auction_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                auction_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["APIResponse_LiveAuctionDetailResponse_"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    open_auction_api_v1_auctions__auction_id__open_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                auction_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    cancel_auction_api_v1_auctions__auction_id__cancel_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                auction_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CancelAuctionRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    release_results_api_v1_auctions__auction_id__release_results_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                auction_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_leaderboard_api_v1_auctions__auction_id__leaderboard_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                auction_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_my_rank_api_v1_auctions__auction_id__my_rank_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                auction_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_bid_history_api_v1_auctions__auction_id__bids_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                auction_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    set_proxy_floor_api_v1_auctions__auction_id__proxy_floor_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                auction_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetProxyFloorRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
