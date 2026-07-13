-- 「親は必ず子を持つ」カテゴリーモデルを保つため、親＋最初の子を原子的に作成する RPC。
-- クライアントから2回 INSERT すると、子作成が失敗した際に子なしの親（旧データの childless親）が
-- 生じうる。ここでは1トランザクション内で親→子を作成し、作成した親IDを返す。
--
-- RLS 方針: 世帯共有モデル（USING(true)）を維持。SECURITY INVOKER のため呼び出し元の権限で実行する。
--   authenticated からの実行を許可するため末尾で GRANT する。
create or replace function create_category_with_first_child(
  p_parent_name text, p_child_name text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parent_name text := trim(p_parent_name);
  v_child_name text := trim(p_child_name);
  v_parent_id uuid;
begin
  if length(v_parent_name) > 100 then
    raise exception '大分類名は100文字以内で入力してください';
  end if;
  if length(v_child_name) > 100 then
    raise exception '小分類名は100文字以内で入力してください';
  end if;

  -- 親は親スコープ（parent_id is null）の末尾に採番する（空なら 0）。
  insert into categories (name, parent_id, sort_order)
    values (
      v_parent_name,
      null,
      coalesce((select max(sort_order) + 1 from categories where parent_id is null), 0)
    )
    returning id into v_parent_id;

  -- 最初の子は新親スコープの先頭（sort_order = 0）。
  insert into categories (name, parent_id, sort_order)
    values (v_child_name, v_parent_id, 0);

  return v_parent_id;
end; $$;

grant execute on function create_category_with_first_child(text, text) to authenticated;
