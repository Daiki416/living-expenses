


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "backup";


ALTER SCHEMA "backup" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_receipt_group"("p_date" "date", "p_description" "text", "p_kind" "text", "p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_receipt receipts%rowtype;
  v_expenses jsonb;
begin
  insert into receipts (date, description, kind)
    values (p_date, p_description, p_kind)
    returning * into v_receipt;

  insert into expenses (receipt_id, description, amount, category_id, paid_by)
    select
      v_receipt.id,
      elem->>'description',
      (elem->>'amount')::int,
      nullif(elem->>'category_id', '')::uuid,
      nullif(elem->>'paid_by', '')
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as elem;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb)
    into v_expenses
    from expenses e
    where e.receipt_id = v_receipt.id;

  return to_jsonb(v_receipt) || jsonb_build_object('expenses', v_expenses);
end;
$$;


ALTER FUNCTION "public"."add_receipt_group"("p_date" "date", "p_description" "text", "p_kind" "text", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_receipt_with_paid_by"("p_id" "uuid", "p_description" "text", "p_date" "date", "p_kind" "text", "p_paid_by" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update receipts
    set description = p_description, date = p_date, kind = p_kind
    where id = p_id;
  update expenses
    set paid_by = p_paid_by
    where receipt_id = p_id;
end;
$$;


ALTER FUNCTION "public"."update_receipt_with_paid_by"("p_id" "uuid", "p_description" "text", "p_date" "date", "p_kind" "text", "p_paid_by" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "backup"."card_expense_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "backup"."card_expense_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup"."card_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "description" "text" NOT NULL,
    "amount" integer NOT NULL,
    "category_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "receipt_id" "uuid" NOT NULL
);


ALTER TABLE "backup"."card_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "keyword" "text" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."category_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classifications" (
    "id" bigint NOT NULL,
    "class_name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "value" "text" NOT NULL,
    "label" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."classifications" OWNER TO "postgres";


ALTER TABLE "public"."classifications" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."classifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paid_by" "text",
    "description" "text" NOT NULL,
    "amount" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category_id" "uuid",
    "receipt_id" "uuid" NOT NULL
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "monthly_budget" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompts" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "content" "text" NOT NULL
);


ALTER TABLE "public"."prompts" OWNER TO "postgres";


ALTER TABLE "public"."prompts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."prompts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "text" NOT NULL,
    CONSTRAINT "receipts_kind_check" CHECK (("kind" = ANY (ARRAY['advance'::"text", 'card'::"text"])))
);


ALTER TABLE "public"."receipts" OWNER TO "postgres";


ALTER TABLE ONLY "backup"."card_expense_receipts"
    ADD CONSTRAINT "card_expense_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "backup"."card_expenses"
    ADD CONSTRAINT "card_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_rules"
    ADD CONSTRAINT "category_rules_keyword_key" UNIQUE ("keyword");



ALTER TABLE ONLY "public"."category_rules"
    ADD CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classifications"
    ADD CONSTRAINT "classifications_class_name_code_key" UNIQUE ("class_name", "code");



ALTER TABLE ONLY "public"."classifications"
    ADD CONSTRAINT "classifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "expense_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompts"
    ADD CONSTRAINT "prompts_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."prompts"
    ADD CONSTRAINT "prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "backup"."card_expenses"
    ADD CONSTRAINT "card_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "backup"."card_expenses"
    ADD CONSTRAINT "card_expenses_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "backup"."card_expense_receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_rules"
    ADD CONSTRAINT "category_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE CASCADE;



CREATE POLICY "authenticated_all" ON "backup"."card_expense_receipts" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "backup"."card_expense_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "backup"."card_expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "card_expenses_authenticated_only" ON "backup"."card_expenses" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."receipts" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_authenticated_only" ON "public"."categories" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."category_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "category_rules_all" ON "public"."category_rules" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."classifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classifications_select" ON "public"."classifications" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_authenticated_only" ON "public"."expenses" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members_authenticated_only" ON "public"."members" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receipts" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."add_receipt_group"("p_date" "date", "p_description" "text", "p_kind" "text", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_receipt_group"("p_date" "date", "p_description" "text", "p_kind" "text", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_receipt_group"("p_date" "date", "p_description" "text", "p_kind" "text", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_receipt_with_paid_by"("p_id" "uuid", "p_description" "text", "p_date" "date", "p_kind" "text", "p_paid_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_receipt_with_paid_by"("p_id" "uuid", "p_description" "text", "p_date" "date", "p_kind" "text", "p_paid_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_receipt_with_paid_by"("p_id" "uuid", "p_description" "text", "p_date" "date", "p_kind" "text", "p_paid_by" "text") TO "service_role";












GRANT ALL ON TABLE "backup"."card_expense_receipts" TO "anon";
GRANT ALL ON TABLE "backup"."card_expense_receipts" TO "authenticated";
GRANT ALL ON TABLE "backup"."card_expense_receipts" TO "service_role";



GRANT ALL ON TABLE "backup"."card_expenses" TO "anon";
GRANT ALL ON TABLE "backup"."card_expenses" TO "authenticated";
GRANT ALL ON TABLE "backup"."card_expenses" TO "service_role";









GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."category_rules" TO "anon";
GRANT ALL ON TABLE "public"."category_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."category_rules" TO "service_role";



GRANT ALL ON TABLE "public"."classifications" TO "anon";
GRANT ALL ON TABLE "public"."classifications" TO "authenticated";
GRANT ALL ON TABLE "public"."classifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."classifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."classifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."classifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."prompts" TO "anon";
GRANT ALL ON TABLE "public"."prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."prompts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prompts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prompts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prompts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receipts" TO "anon";
GRANT ALL ON TABLE "public"."receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."receipts" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































