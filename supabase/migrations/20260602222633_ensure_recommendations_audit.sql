-- Ensure audit logging is active on recommendation_sets as requested by the acceptance criteria
-- (recommendation_items already has it, ensuring sets has it too)

DROP TRIGGER IF EXISTS audit_logs_trigger ON public.recommendation_sets;
CREATE TRIGGER audit_logs_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.recommendation_sets
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
