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
         * @description List categories (flat or tree view).
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
         * @description Get full category hierarchy tree or subtree via recursive CTE.
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
        post?: never;
        delete?: never;
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
        post?: never;
        delete?: never;
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
        post?: never;
        delete?: never;
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
    "/api/v1/sourcing/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_sourcing_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/bids/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_v1_bids_health_get"];
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
        get?: never;
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
         * @description POST /api/v1/auth/login — password login. Returns access_token; sets refresh_token cookie.
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
         * @description POST /api/v1/auth/refresh — reads refresh_token from httpOnly cookie.
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
         * @description POST /api/v1/auth/logout — revokes session and clears refresh_token cookie.
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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** APIResponse[List[PRDetailResponse]] */
        APIResponse_List_PRDetailResponse__: {
            /** Data */
            data: components["schemas"]["PRDetailResponse"][];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             * @default 2026-09-04T09:42:04.877405
             */
            timestamp: string;
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
             * @default 2026-09-04T09:42:04.877405
             */
            timestamp: string;
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
             * @default 2026-09-04T09:42:04.877405
             */
            timestamp: string;
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
             * @default 2026-09-04T09:42:04.877405
             */
            timestamp: string;
        };
        /** APIResponse[PRDetailResponse] */
        APIResponse_PRDetailResponse_: {
            data: components["schemas"]["PRDetailResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             * @default 2026-09-04T09:42:04.877405
             */
            timestamp: string;
        };
        /** APIResponse[UnmappedPRDashboardResponse] */
        APIResponse_UnmappedPRDashboardResponse_: {
            data: components["schemas"]["UnmappedPRDashboardResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             * @default 2026-09-04T09:42:04.877405
             */
            timestamp: string;
        };
        /** APIResponse[UnmappedPRSuggestionResponse] */
        APIResponse_UnmappedPRSuggestionResponse_: {
            data: components["schemas"]["UnmappedPRSuggestionResponse"];
            meta?: components["schemas"]["PaginationMeta"] | null;
            links?: components["schemas"]["Links"] | null;
            /**
             * Timestamp
             * Format: date-time
             * @default 2026-09-04T09:42:04.877405
             */
            timestamp: string;
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
        /** ApprovalRuleResponse */
        ApprovalRuleResponse: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Entity Type */
            entity_type: string;
            /** Rule Code */
            rule_code: string;
            /** Rule Name */
            rule_name: string;
            /** Priority */
            priority: number;
            /** Conditions */
            conditions: {
                [key: string]: unknown;
            };
            /** Condition Expression */
            condition_expression: string | null;
            /** Workflow Template Code */
            workflow_template_code: string;
            /** Is Active */
            is_active: boolean;
            /** Is Catch All */
            is_catch_all: boolean;
            /**
             * Effective From
             * Format: date-time
             */
            effective_from: string;
            /** Effective To */
            effective_to: string | null;
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
        /** ApprovalRuleSimulateResponse */
        ApprovalRuleSimulateResponse: {
            matched_rule: components["schemas"]["ApprovalRuleResponse"] | null;
            /** Workflow Template Code */
            workflow_template_code: string | null;
            /** Match Type */
            match_type: string;
            /** Evaluated Rules Count */
            evaluated_rules_count: number;
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
        /** Body_import_categories_api_v1_master_data_import_categories_post */
        Body_import_categories_api_v1_master_data_import_categories_post: {
            /** File */
            file: string;
        };
        /** CancelRequest */
        CancelRequest: {
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
        /** ForceAdvanceRequest */
        ForceAdvanceRequest: {
            /** Reason */
            reason: string;
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
        /** Links */
        Links: {
            /** Self */
            self_?: string | null;
            /** Next */
            next_?: string | null;
            /** Prev */
            prev_?: string | null;
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
        /** PRApprovalAction */
        PRApprovalAction: {
            /** Action */
            action: string;
            /** Comment */
            comment?: string | null;
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
            /**
             * Page
             * @default 1
             */
            page: number;
            /**
             * Page Size
             * @default 20
             */
            page_size: number;
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
            /** Page Number */
            page_number?: number | null;
            /** Total Records */
            total_records?: number | null;
            /** Has Next Page */
            has_next_page?: boolean | null;
            /** Has Prev Page */
            has_prev_page?: boolean | null;
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
        /** SimulateRequest */
        SimulateRequest: {
            /** Template Code */
            template_code: string;
            /** Entity Context */
            entity_context?: {
                [key: string]: unknown;
            };
        };
        /** TaskActionRequest */
        TaskActionRequest: {
            /**
             * Comment
             * @default
             */
            comment: string;
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
        /** WorkflowSimulateResponse */
        WorkflowSimulateResponse: {
            /** Chain */
            chain: components["schemas"]["WorkflowSimulateStepResponse"][];
        };
        /** WorkflowSimulateStepResponse */
        WorkflowSimulateStepResponse: {
            /** Step Number */
            step_number: number;
            /** Step Name */
            step_name: string | null;
            /** Step Type */
            step_type?: string | null;
            /** Approvers */
            approvers?: components["schemas"]["WorkflowStepApprover"][] | null;
            /** Sla Hours */
            sla_hours?: number | null;
            /** Convergence */
            convergence?: string | null;
            /** Condition Met */
            condition_met: boolean;
            /** Condition Expression */
            condition_expression?: string | null;
        };
        /** WorkflowStepApprover */
        WorkflowStepApprover: {
            /** Id */
            id: string;
            /** Name */
            name: string;
            /** Role */
            role: string | null;
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
    health_api_v1_sourcing_health_get: {
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
    health_api_v1_bids_health_get: {
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
                "application/json": components["schemas"]["CancelRequest"];
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
                    "application/json": components["schemas"]["WorkflowSimulateResponse"];
                };
            };
            /** @description Validation Error */
            422: {
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
                    "application/json": components["schemas"]["ApprovalRuleSimulateResponse"];
                };
            };
            /** @description Validation Error */
            422: {
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
}
