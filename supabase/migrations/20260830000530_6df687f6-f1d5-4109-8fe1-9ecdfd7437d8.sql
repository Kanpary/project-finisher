revoke all on function public.grant_owner_admin() from public;
revoke all on function public.set_updated_at() from public;
revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.is_admin() from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;