/**
 * Hand-maintained shape for Phases 1–6. CI applies the migrations and
 * smoke-checks the schema and grants instead of regenerating this file.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamps = {
  created_at: string;
  updated_at: string;
};

type Owned = {
  id: string;
  owner_id: string;
};

type Publishable = {
  is_published: boolean;
  sort_order: number;
  deleted_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          role: "owner";
          status: "active" | "suspended";
          headline: string | null;
          bio_md: string | null;
          location: string | null;
          timezone: string;
          avatar_path: string | null;
          resume_path: string | null;
          resume_updated_at: string | null;
        } & Timestamps;
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          email: string;
          display_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          reporting_currency: string;
          theme: "light" | "dark" | "system";
          date_format: string;
          locale: string;
          mfa_enforced: boolean;
          reporting_notes: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_settings"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Row"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          table_name: string;
          record_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          reason: string | null;
          occurred_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          action: string;
          table_name: string;
        };
        Update: never;
        Relationships: [];
      };
      currencies: {
        Row: {
          code: string;
          name: string;
          minor_units: number;
          is_active: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["currencies"]["Row"]> & {
          code: string;
          name: string;
          minor_units: number;
        };
        Update: Partial<Database["public"]["Tables"]["currencies"]["Row"]>;
        Relationships: [];
      };
      exchange_rates: {
        Row: {
          id: string;
          from_currency: string;
          to_currency: string;
          rate: number;
          effective_date: string;
          source: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["exchange_rates"]["Row"]> & {
          from_currency: string;
          to_currency: string;
          rate: number;
          effective_date: string;
          source: string;
        };
        Update: never;
        Relationships: [];
      };
      portfolio_projects: {
        Row: Owned &
          Publishable &
          Timestamps & {
            title: string;
            slug: string;
            short_description: string | null;
            description_md: string | null;
            tech_stack: string[];
            github_url: string | null;
            demo_url: string | null;
            image_path: string | null;
            start_date: string | null;
            completion_date: string | null;
            is_featured: boolean;
          };
        Insert: Partial<Database["public"]["Tables"]["portfolio_projects"]["Row"]> & {
          owner_id: string;
          title: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["portfolio_projects"]["Row"]>;
        Relationships: [];
      };
      experiences: {
        Row: Owned &
          Publishable &
          Timestamps & {
            company: string;
            position: string;
            start_date: string | null;
            end_date: string | null;
            is_current: boolean;
            responsibilities: string[];
            technologies: string[];
          };
        Insert: Partial<Database["public"]["Tables"]["experiences"]["Row"]> & {
          owner_id: string;
          company: string;
          position: string;
        };
        Update: Partial<Database["public"]["Tables"]["experiences"]["Row"]>;
        Relationships: [];
      };
      education: {
        Row: Owned &
          Publishable &
          Timestamps & {
            institution: string;
            degree: string;
            field_of_study: string | null;
            start_date: string | null;
            end_date: string | null;
            description_md: string | null;
          };
        Insert: Partial<Database["public"]["Tables"]["education"]["Row"]> & {
          owner_id: string;
          institution: string;
          degree: string;
        };
        Update: Partial<Database["public"]["Tables"]["education"]["Row"]>;
        Relationships: [];
      };
      skills: {
        Row: Owned &
          Publishable &
          Timestamps & {
            name: string;
            category: string;
            proficiency: number | null;
            icon: string | null;
          };
        Insert: Partial<Database["public"]["Tables"]["skills"]["Row"]> & {
          owner_id: string;
          name: string;
          category: string;
        };
        Update: Partial<Database["public"]["Tables"]["skills"]["Row"]>;
        Relationships: [];
      };
      certifications: {
        Row: Owned &
          Publishable &
          Timestamps & {
            name: string;
            issuer: string;
            issued_on: string | null;
            expires_on: string | null;
            credential_url: string | null;
            document_id: string | null;
          };
        Insert: Partial<Database["public"]["Tables"]["certifications"]["Row"]> & {
          owner_id: string;
          name: string;
          issuer: string;
        };
        Update: Partial<Database["public"]["Tables"]["certifications"]["Row"]>;
        Relationships: [];
      };
      social_links: {
        Row: Owned &
          Timestamps & {
            platform: string;
            url: string;
            sort_order: number;
            is_published: boolean;
          };
        Insert: Partial<Database["public"]["Tables"]["social_links"]["Row"]> & {
          owner_id: string;
          platform: string;
          url: string;
        };
        Update: Partial<Database["public"]["Tables"]["social_links"]["Row"]>;
        Relationships: [];
      };
      blog_categories: {
        Row: Owned &
          Timestamps & {
            name: string;
            slug: string;
            description: string | null;
          };
        Insert: Partial<Database["public"]["Tables"]["blog_categories"]["Row"]> & {
          owner_id: string;
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["blog_categories"]["Row"]>;
        Relationships: [];
      };
      blog_tags: {
        Row: Owned &
          Timestamps & {
            name: string;
            slug: string;
          };
        Insert: Partial<Database["public"]["Tables"]["blog_tags"]["Row"]> & {
          owner_id: string;
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["blog_tags"]["Row"]>;
        Relationships: [];
      };
      posts: {
        Row: Owned &
          Timestamps & {
            author_id: string;
            title: string;
            slug: string;
            excerpt: string | null;
            content_md: string;
            title_en: string | null;
            excerpt_en: string | null;
            content_md_en: string | null;
            cover_path: string | null;
            category_id: string | null;
            status: "draft" | "scheduled" | "published" | "archived";
            published_at: string | null;
            scheduled_for: string | null;
            seo_title: string | null;
            seo_description: string | null;
            is_featured: boolean;
            reading_minutes: number;
            deleted_at: string | null;
          };
        Insert: Partial<Database["public"]["Tables"]["posts"]["Row"]> & {
          owner_id: string;
          author_id: string;
          title: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Row"]>;
        Relationships: [];
      };
      post_tags: {
        Row: {
          post_id: string;
          tag_id: string;
        };
        Insert: {
          post_id: string;
          tag_id: string;
        };
        Update: never;
        Relationships: [];
      };
      contacts: {
        Row: Owned &
          Timestamps & {
            full_name: string;
            contact_type: "individual" | "organization";
            phone: string | null;
            email: string | null;
            address: string | null;
            country_code: string | null;
            notes: string | null;
            archived_at: string | null;
          };
        Insert: Partial<Database["public"]["Tables"]["contacts"]["Row"]> & {
          owner_id: string;
          full_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Row"]>;
        Relationships: [];
      };
      accounts: {
        Row: Owned &
          Timestamps & {
            name: string;
            country_code: string | null;
            currency_code: string;
            account_type: "bank" | "savings" | "cash" | "mobile_money" | "other";
            opening_balance: number;
            opening_date: string | null;
            description: string | null;
            is_active: boolean;
          };
        Insert: Partial<Database["public"]["Tables"]["accounts"]["Row"]> & {
          owner_id: string;
          name: string;
          currency_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Row"]>;
        Relationships: [];
      };
      finance_categories: {
        Row: Owned &
          Timestamps & {
            name: string;
            kind: "income" | "expense";
            parent_id: string | null;
            icon: string | null;
            is_active: boolean;
          };
        Insert: Partial<
          Database["public"]["Tables"]["finance_categories"]["Row"]
        > & { owner_id: string; name: string; kind: "income" | "expense" };
        Update: Partial<
          Database["public"]["Tables"]["finance_categories"]["Row"]
        >;
        Relationships: [];
      };
      financial_transactions: {
        Row: Owned & {
          account_id: string;
          transaction_type:
            | "income"
            | "expense"
            | "transfer_out"
            | "transfer_in"
            | "loan_disbursed"
            | "loan_repayment_received"
            | "borrowing_received"
            | "borrowing_repayment_paid"
            | "donation"
            | "correction"
            | "reversal";
          direction: -1 | 1;
          amount: number;
          currency_code: string;
          business_date: string;
          category_id: string | null;
          transfer_id: string | null;
          reference_type: string | null;
          reference_id: string | null;
          description: string | null;
          notes: string | null;
          attachment_path: string | null;
          reverses_transaction_id: string | null;
          is_reversal: boolean;
          exchange_rate_to_reporting: number;
          reporting_currency: string;
          amount_reporting: number;
          created_at: string;
          created_by: string | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["financial_transactions"]["Row"]
        > & {
          owner_id: string;
          account_id: string;
          transaction_type: Database["public"]["Tables"]["financial_transactions"]["Row"]["transaction_type"];
          direction: -1 | 1;
          amount: number;
          currency_code: string;
          business_date: string;
          exchange_rate_to_reporting: number;
          reporting_currency: string;
        };
        Update: never;
        Relationships: [];
      };
      account_transfers: {
        Row: Owned &
          Timestamps & {
            source_account_id: string;
            destination_account_id: string;
            source_amount: number;
            source_currency: string;
            destination_amount: number;
            destination_currency: string;
            exchange_rate: number;
            fee_amount: number;
            transfer_date: string;
            reference_number: string | null;
            notes: string | null;
            out_ledger_id: string | null;
            in_ledger_id: string | null;
            fee_ledger_id: string | null;
          };
        Insert: Partial<
          Database["public"]["Tables"]["account_transfers"]["Row"]
        > & {
          owner_id: string;
          source_account_id: string;
          destination_account_id: string;
          source_amount: number;
          source_currency: string;
          destination_amount: number;
          destination_currency: string;
          exchange_rate: number;
          transfer_date: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["account_transfers"]["Row"]
        >;
        Relationships: [];
      };
      loans_given: {
        Row: Owned &
          Timestamps & {
            contact_id: string;
            amount: number;
            currency_code: string;
            date_given: string;
            reason: string | null;
            payment_method: string | null;
            source_account_id: string;
            expected_repayment_date: string | null;
            reference_number: string | null;
            notes: string | null;
            cancelled_at: string | null;
            disbursement_ledger_id: string | null;
          };
        Insert: Partial<Database["public"]["Tables"]["loans_given"]["Row"]> & {
          owner_id: string;
          contact_id: string;
          amount: number;
          currency_code: string;
          date_given: string;
          source_account_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["loans_given"]["Row"]>;
        Relationships: [];
      };
      loan_given_repayments: {
        Row: Owned & {
          loan_id: string;
          amount: number;
          repayment_date: string;
          receiving_account_id: string;
          payment_method: string | null;
          reference_number: string | null;
          notes: string | null;
          ledger_transaction_id: string | null;
          cancelled_at: string | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["loan_given_repayments"]["Row"]
        > & {
          owner_id: string;
          loan_id: string;
          amount: number;
          repayment_date: string;
          receiving_account_id: string;
        };
        Update: never;
        Relationships: [];
      };
      loans_taken: {
        Row: Owned &
          Timestamps & {
            lender_contact_id: string;
            amount: number;
            currency_code: string;
            date_borrowed: string;
            reason: string | null;
            expected_repayment_date: string | null;
            receiving_account_id: string;
            agreement_details: string | null;
            notes: string | null;
            cancelled_at: string | null;
            receipt_ledger_id: string | null;
          };
        Insert: Partial<Database["public"]["Tables"]["loans_taken"]["Row"]> & {
          owner_id: string;
          lender_contact_id: string;
          amount: number;
          currency_code: string;
          date_borrowed: string;
          receiving_account_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["loans_taken"]["Row"]>;
        Relationships: [];
      };
      loan_taken_repayments: {
        Row: Owned & {
          loan_id: string;
          amount: number;
          payment_date: string;
          source_account_id: string;
          payment_method: string | null;
          reference_number: string | null;
          notes: string | null;
          ledger_transaction_id: string | null;
          cancelled_at: string | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["loan_taken_repayments"]["Row"]
        > & {
          owner_id: string;
          loan_id: string;
          amount: number;
          payment_date: string;
          source_account_id: string;
        };
        Update: never;
        Relationships: [];
      };
      donation_categories: {
        Row: Owned &
          Timestamps & {
            name: string;
            slug: string;
          };
        Insert: Partial<
          Database["public"]["Tables"]["donation_categories"]["Row"]
        > & { owner_id: string; name: string; slug: string };
        Update: Partial<
          Database["public"]["Tables"]["donation_categories"]["Row"]
        >;
        Relationships: [];
      };
      donations: {
        Row: Owned & {
          contact_id: string | null;
          recipient_name: string;
          recipient_type: "individual" | "organization";
          amount: number;
          currency_code: string;
          donation_date: string;
          purpose: string | null;
          category_id: string | null;
          country_code: string | null;
          source_account_id: string;
          payment_method: string | null;
          reference_number: string | null;
          notes: string | null;
          ledger_transaction_id: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["donations"]["Row"]> & {
          owner_id: string;
          recipient_name: string;
          recipient_type: "individual" | "organization";
          amount: number;
          currency_code: string;
          donation_date: string;
          source_account_id: string;
        };
        Update: never;
        Relationships: [];
      };
      donation_corrections: {
        Row: Owned & {
          donation_id: string;
          correction_type: "reversal" | "adjustment";
          amount: number;
          reason: string;
          ledger_transaction_id: string | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["donation_corrections"]["Row"]
        > & {
          owner_id: string;
          donation_id: string;
          correction_type: "reversal" | "adjustment";
          amount: number;
          reason: string;
        };
        Update: never;
        Relationships: [];
      };
      properties: {
        Row: Owned &
          Timestamps & {
            name: string;
            country_code: string | null;
            division: string | null;
            district: string | null;
            upazila: string | null;
            union_name: string | null;
            village: string | null;
            mouza: string | null;
            khatian_number: string | null;
            dag_number: string | null;
            land_classification: string | null;
            total_area: number | null;
            area_unit: string | null;
            purchase_date: string | null;
            purchase_price: number | null;
            currency_code: string | null;
            current_estimated_value: number | null;
            notes: string | null;
          };
        Insert: Partial<Database["public"]["Tables"]["properties"]["Row"]> & {
          owner_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["properties"]["Row"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          owner_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          category:
            | "deed"
            | "khatian"
            | "mutation"
            | "tax_receipt"
            | "agreement"
            | "map"
            | "resume"
            | "certification"
            | "loan"
            | "donation"
            | "other";
          description: string | null;
          uploaded_at: string;
          related_contact_id: string | null;
          related_transaction_id: string | null;
          related_property_id: string | null;
          related_loan_given_id: string | null;
          related_loan_taken_id: string | null;
          related_donation_id: string | null;
          tags: string[];
        };
        Insert: Partial<Database["public"]["Tables"]["documents"]["Row"]> & {
          owner_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          category: Database["public"]["Tables"]["documents"]["Row"]["category"];
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Row"]>;
        Relationships: [];
      };
      property_ownerships: {
        Row: Owned &
          Timestamps & {
            property_id: string;
            owner_name: string;
            ownership_percentage: number;
            acquisition_date: string | null;
            ownership_type: string | null;
            notes: string | null;
          };
        Insert: Partial<
          Database["public"]["Tables"]["property_ownerships"]["Row"]
        > & {
          owner_id: string;
          property_id: string;
          owner_name: string;
          ownership_percentage: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["property_ownerships"]["Row"]
        >;
        Relationships: [];
      };
      property_documents: {
        Row: Owned & {
          property_id: string;
          document_id: string;
          document_type:
            | "deed"
            | "khatian"
            | "mutation"
            | "tax_receipt"
            | "agreement"
            | "map"
            | "other";
          issued_on: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["property_documents"]["Row"]
        > & {
          owner_id: string;
          property_id: string;
          document_id: string;
          document_type: Database["public"]["Tables"]["property_documents"]["Row"]["document_type"];
        };
        Update: Partial<
          Database["public"]["Tables"]["property_documents"]["Row"]
        >;
        Relationships: [];
      };
      property_valuations: {
        Row: Owned & {
          id: string;
          property_id: string;
          estimated_value: number;
          currency_code: string;
          valued_on: string;
          source: string | null;
          is_verified: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["property_valuations"]["Row"]
        > & {
          owner_id: string;
          property_id: string;
          estimated_value: number;
          currency_code: string;
          valued_on: string;
        };
        Update: never;
        Relationships: [];
      };
      unit_conversions: {
        Row: {
          id: string;
          from_unit: string;
          to_unit: string;
          factor: number;
          source_note: string | null;
          valid_from: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["unit_conversions"]["Row"]> & {
          from_unit: string;
          to_unit: string;
          factor: number;
        };
        Update: Partial<Database["public"]["Tables"]["unit_conversions"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      public_profiles_v: {
        Row: {
          id: string;
          display_name: string;
          headline: string | null;
          bio_md: string | null;
          location: string | null;
          avatar_path: string | null;
          resume_updated_at: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
      account_balances_v: {
        Row: {
          owner_id: string;
          account_id: string;
          name: string;
          currency_code: string;
          opening_balance: number;
          ledger_balance: number;
          balance: number;
        };
        Relationships: [];
      };
      monthly_cashflow_v: {
        Row: {
          owner_id: string;
          month: string;
          country_code: string | null;
          currency_code: string;
          reporting_currency: string;
          income_amount: number;
          expense_amount: number;
          net_amount: number;
          income_reporting: number;
          expense_reporting: number;
          net_reporting: number;
        };
        Relationships: [];
      };
      loans_given_status_v: {
        Row: Database["public"]["Tables"]["loans_given"]["Row"] & {
          total_repaid: number;
          outstanding: number;
          status:
            | "Cancelled"
            | "Fully Repaid"
            | "Partially Repaid"
            | "Overdue"
            | "Pending";
        };
        Relationships: [];
      };
      loans_taken_status_v: {
        Row: Database["public"]["Tables"]["loans_taken"]["Row"] & {
          total_repaid: number;
          outstanding: number;
          status:
            | "Cancelled"
            | "Fully Repaid"
            | "Partially Repaid"
            | "Overdue"
            | "Active";
        };
        Relationships: [];
      };
      contact_lending_summary_v: {
        Row: {
          owner_id: string;
          contact_id: string;
          full_name: string;
          contact_type: "individual" | "organization";
          currency_code: string;
          lent_amount: number;
          repaid_amount: number;
          outstanding_amount: number;
          overdue_amount: number;
          loan_count: number;
          first_date: string;
          last_date: string;
        };
        Relationships: [];
      };
      contact_donation_summary_v: {
        Row: {
          owner_id: string;
          recipient_key: string;
          contact_id: string | null;
          recipient_name: string;
          recipient_type: "individual" | "organization";
          currency_code: string;
          country_code: string | null;
          total_amount: number;
          donation_count: number;
          first_date: string;
          last_date: string;
        };
        Relationships: [];
      };
      net_worth_v: {
        Row: {
          owner_id: string;
          as_of: string;
          reporting_currency: string;
          cash_amount_reporting: number;
          property_amount_reporting: number;
          receivables_amount_reporting: number;
          payables_amount_reporting: number;
          net_amount_reporting: number;
          missing_rate_currencies: string[];
        };
        Relationships: [];
      };
    };
    Functions: {
      is_owner: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      require_owner: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      get_resume_path: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      publish_scheduled_posts: {
        Args: Record<string, never>;
        Returns: Array<{ id: string; slug: string }>;
      };
      resolve_reporting_rate: {
        Args: {
          p_currency_code: string;
          p_reporting_currency: string;
          p_business_date: string;
        };
        Returns: number;
      };
      create_income: {
        Args: {
          p_account_id: string;
          p_amount: string;
          p_business_date: string;
          p_category_id: string | null;
          p_description: string | null;
          p_notes: string | null;
          p_reference_number: string | null;
        };
        Returns: string;
      };
      create_expense: {
        Args: {
          p_account_id: string;
          p_amount: string;
          p_business_date: string;
          p_category_id: string | null;
          p_description: string | null;
          p_notes: string | null;
          p_reference_number: string | null;
        };
        Returns: string;
      };
      create_transfer: {
        Args: {
          p_source_account_id: string;
          p_destination_account_id: string;
          p_source_amount: string;
          p_destination_amount: string;
          p_exchange_rate: string;
          p_fee_amount: string;
          p_transfer_date: string;
          p_reference_number: string | null;
          p_notes: string | null;
        };
        Returns: string;
      };
      create_loan_given: {
        Args: {
          p_contact_id: string;
          p_amount: string;
          p_currency_code: string;
          p_date_given: string;
          p_source_account_id: string;
          p_expected_repayment_date?: string | null;
          p_reason?: string | null;
          p_payment_method?: string | null;
          p_reference_number?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      record_loan_given_repayment: {
        Args: {
          p_loan_id: string;
          p_amount: string;
          p_repayment_date: string;
          p_receiving_account_id: string;
          p_payment_method?: string | null;
          p_reference_number?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      create_loan_taken: {
        Args: {
          p_lender_contact_id: string;
          p_amount: string;
          p_currency_code: string;
          p_date_borrowed: string;
          p_receiving_account_id: string;
          p_expected_repayment_date?: string | null;
          p_reason?: string | null;
          p_agreement_details?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      record_loan_taken_repayment: {
        Args: {
          p_loan_id: string;
          p_amount: string;
          p_payment_date: string;
          p_source_account_id: string;
          p_payment_method?: string | null;
          p_reference_number?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      create_donation: {
        Args: {
          p_contact_id?: string | null;
          p_recipient_name?: string | null;
          p_recipient_type?: string | null;
          p_amount?: string | null;
          p_currency_code?: string | null;
          p_donation_date?: string | null;
          p_source_account_id?: string | null;
          p_purpose?: string | null;
          p_category_id?: string | null;
          p_country_code?: string | null;
          p_payment_method?: string | null;
          p_reference_number?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      correct_donation: {
        Args: {
          p_donation_id: string;
          p_correction_type: string;
          p_amount: string;
          p_reason: string;
        };
        Returns: string;
      };
      safe_reporting_rate: {
        Args: {
          p_currency_code: string;
          p_reporting_currency: string;
          p_as_of: string;
        };
        // Null means no snapshotted rate was available for this component.
        Returns: number | null;
      };
      net_worth_at: {
        Args: {
          p_owner_id: string;
          p_as_of: string;
          p_reporting_currency: string;
        };
        Returns: Database["public"]["Views"]["net_worth_v"]["Row"][];
      };
      get_net_worth: {
        Args: {
          p_as_of?: string | null;
          p_reporting_currency?: string | null;
        };
        Returns: Database["public"]["Views"]["net_worth_v"]["Row"][];
      };
      get_dashboard_summary: {
        Args: {
          p_from_date?: string | null;
          p_to_date?: string | null;
          p_country_code?: string | null;
          p_currency_code?: string | null;
        };
        Returns: Json;
      };
      add_property_owner: {
        Args: { p_property_id: string; p_owners: Json };
        Returns: string;
      };
      create_property: {
        Args: {
          p_name: string;
          p_area_unit: string;
          p_country_code?: string | null;
          p_division?: string | null;
          p_district?: string | null;
          p_upazila?: string | null;
          p_union_name?: string | null;
          p_village?: string | null;
          p_mouza?: string | null;
          p_khatian_number?: string | null;
          p_dag_number?: string | null;
          p_land_classification?: string | null;
          p_total_area?: string | null;
          p_purchase_date?: string | null;
          p_purchase_price?: string | null;
          p_currency_code?: string | null;
          p_current_estimated_value?: string | null;
          p_notes?: string | null;
          p_owners?: Json;
        };
        Returns: string;
      };
      record_property_valuation: {
        Args: {
          p_property_id: string;
          p_estimated_value: string;
          p_currency_code: string;
          p_valued_on: string;
          p_source?: string | null;
          p_is_verified?: boolean | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type PublicProfile = Database["public"]["Views"]["public_profiles_v"]["Row"];
export type PortfolioProject = Database["public"]["Tables"]["portfolio_projects"]["Row"];
export type Experience = Database["public"]["Tables"]["experiences"]["Row"];
export type Education = Database["public"]["Tables"]["education"]["Row"];
export type Skill = Database["public"]["Tables"]["skills"]["Row"];
export type Certification = Database["public"]["Tables"]["certifications"]["Row"];
export type SocialLink = Database["public"]["Tables"]["social_links"]["Row"];
export type BlogCategory = Database["public"]["Tables"]["blog_categories"]["Row"];
export type BlogTag = Database["public"]["Tables"]["blog_tags"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type PostTag = Database["public"]["Tables"]["post_tags"]["Row"];
export type PostStatus = Post["status"];

export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type FinanceCategory =
  Database["public"]["Tables"]["finance_categories"]["Row"];
export type FinancialTransaction =
  Database["public"]["Tables"]["financial_transactions"]["Row"];
export type LedgerTransactionType =
  FinancialTransaction["transaction_type"];
export type AccountTransfer =
  Database["public"]["Tables"]["account_transfers"]["Row"];
export type AccountBalance =
  Database["public"]["Views"]["account_balances_v"]["Row"];
export type MonthlyCashflow =
  Database["public"]["Views"]["monthly_cashflow_v"]["Row"];
export type LoanGiven = Database["public"]["Tables"]["loans_given"]["Row"];
export type LoanGivenRepayment =
  Database["public"]["Tables"]["loan_given_repayments"]["Row"];
export type LoanTaken = Database["public"]["Tables"]["loans_taken"]["Row"];
export type LoanTakenRepayment =
  Database["public"]["Tables"]["loan_taken_repayments"]["Row"];
export type LoanGivenStatus =
  Database["public"]["Views"]["loans_given_status_v"]["Row"];
export type LoanTakenStatus =
  Database["public"]["Views"]["loans_taken_status_v"]["Row"];
export type ContactLendingSummary =
  Database["public"]["Views"]["contact_lending_summary_v"]["Row"];
export type DonationCategory =
  Database["public"]["Tables"]["donation_categories"]["Row"];
export type Donation = Database["public"]["Tables"]["donations"]["Row"];
export type DonationCorrection =
  Database["public"]["Tables"]["donation_corrections"]["Row"];
export type ContactDonationSummary =
  Database["public"]["Views"]["contact_donation_summary_v"]["Row"];
export type Property = Database["public"]["Tables"]["properties"]["Row"];
export type PropertyOwnership =
  Database["public"]["Tables"]["property_ownerships"]["Row"];
export type PropertyDocumentLink =
  Database["public"]["Tables"]["property_documents"]["Row"];
export type PropertyValuation =
  Database["public"]["Tables"]["property_valuations"]["Row"];
export type UnitConversion =
  Database["public"]["Tables"]["unit_conversions"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type NetWorth = Database["public"]["Views"]["net_worth_v"]["Row"];

export type DashboardSummary = {
  filters: {
    from: string | null;
    to: string | null;
    countryCode: string | null;
    currencyCode: string | null;
    reportingCurrency: string;
  };
  counts: {
    accounts: number;
    contacts: number;
    properties: number;
    documents: number;
    publishedPosts: number;
  };
  cashByCurrency: Record<string, number>;
  cashflow: {
    incomeAmount: number;
    expenseAmount: number;
    incomeReporting: number;
    expenseReporting: number;
  };
  donationsByCurrency: Record<string, number>;
  outstanding: {
    receivable: Record<string, number>;
    payable: Record<string, number>;
  };
  netWorth: NetWorth;
};

/** The JSON shape sent to add_property_owner() and create_property(). */
export type PropertyOwnerInput = {
  owner_name: string;
  ownership_percentage: string;
  acquisition_date?: string | null;
  ownership_type?: string | null;
  notes?: string | null;
};

/** Post plus the nested relations used by the public detail page. */
export type PostDetail = Post & {
  blog_categories: Pick<BlogCategory, "id" | "name" | "slug"> | null;
  post_tags: Array<{
    blog_tags: Pick<BlogTag, "id" | "name" | "slug"> | null;
  }>;
};
