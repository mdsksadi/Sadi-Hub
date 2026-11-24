/**
 * Minimal hand-maintained shape for Phases 1–2. CI regenerates this file with
 * `supabase gen types typescript --local` after migrations are applied.
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

/** Post plus the nested relations used by the public detail page. */
export type PostDetail = Post & {
  blog_categories: Pick<BlogCategory, "id" | "name" | "slug"> | null;
  post_tags: Array<{
    blog_tags: Pick<BlogTag, "id" | "name" | "slug"> | null;
  }>;
};
