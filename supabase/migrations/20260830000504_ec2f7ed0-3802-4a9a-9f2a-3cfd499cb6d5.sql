revoke all on function public.grant_owner_admin() from anon, authenticated;
revoke all on function public.set_updated_at() from anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from anon;
revoke all on function public.is_admin() from anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;