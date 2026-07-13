-- カテゴリーRPCの堅牢化。
--   1) create: trim後の空文字を拒否する検証を追加（既存ファイルは編集せず create or replace で上書き）。
--   2) delete: 「子削除→親が子ゼロなら親削除」をサーバ側の現在状態で1トランザクション判定する。
--      クライアントの stale な categories に依存した2リクエスト実行では、別端末で同じ親に
--      子が足された直後に新規子まで CASCADE で巻き込まれ得るため、サーバ現在状態で判定する。
--
-- RLS 方針: 世帯共有モデル（USING(true)）を維持。SECURITY INVOKER のため呼び出し元権限で実行し、
--   末尾で authenticated に GRANT する。

-- 1. create RPC を再定義（空文字拒否を追加）。
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
  if v_parent_name is null or v_parent_name = '' then
    raise exception '大分類名を入力してください';
  end if;
  if v_child_name is null or v_child_name = '' then
    raise exception '小分類名を入力してください';
  end if;
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

-- 2. delete RPC。子削除時のみ親の孤児判定を現在状態で行う。
--    親を直接削除した場合は v_parent_id が null なので子は CASCADE で消えるだけ。
--    子削除時は孤児判定の前に親行を for update でロックし、同じ親への子 INSERT
--    （FK の key-share ロック）と直列化して「削除直前に足された子を巻き込む」レースを閉じる。
create or replace function delete_category(p_category_id uuid) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare v_parent_id uuid;
begin
  select parent_id into v_parent_id from categories where id = p_category_id;
  if v_parent_id is not null then
    perform 1 from categories where id = v_parent_id for update;  -- 親をロック
  end if;
  delete from categories where id = p_category_id;
  if v_parent_id is not null
     and not exists (select 1 from categories where parent_id = v_parent_id) then
    delete from categories where id = v_parent_id;
  end if;
end; $$;

grant execute on function delete_category(uuid) to authenticated;
