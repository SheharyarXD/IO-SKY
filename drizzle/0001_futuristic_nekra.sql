ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_acceptances" ADD CONSTRAINT "agreement_acceptances_versionId_agreement_versions_id_fk" FOREIGN KEY ("versionId") REFERENCES "public"."agreement_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_documentId_legal_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."legal_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_scans" ADD CONSTRAINT "ai_scans_leadId_leads_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_answers" ADD CONSTRAINT "booking_answers_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_audit" ADD CONSTRAINT "booking_audit_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_reminders" ADD CONSTRAINT "booking_reminders_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_uploadedByUserId_users_id_fk" FOREIGN KEY ("uploadedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_messages" ADD CONSTRAINT "client_messages_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notifications" ADD CONSTRAINT "client_notifications_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_project_milestones" ADD CONSTRAINT "client_project_milestones_projectId_client_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."client_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_recommendations" ADD CONSTRAINT "client_recommendations_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_recommendations" ADD CONSTRAINT "client_recommendations_reportId_client_reports_id_fk" FOREIGN KEY ("reportId") REFERENCES "public"."client_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reports" ADD CONSTRAINT "client_reports_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_support_tickets" ADD CONSTRAINT "client_support_tickets_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_support_tickets" ADD CONSTRAINT "client_support_tickets_openedByUserId_users_id_fk" FOREIGN KEY ("openedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookie_consents" ADD CONSTRAINT "cookie_consents_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookie_consents" ADD CONSTRAINT "cookie_consents_policyVersionId_agreement_versions_id_fk" FOREIGN KEY ("policyVersionId") REFERENCES "public"."agreement_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_discovery_sessions" ADD CONSTRAINT "custom_discovery_sessions_leadId_leads_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_access_requests" ADD CONSTRAINT "developer_access_requests_developerId_developer_profiles_id_fk" FOREIGN KEY ("developerId") REFERENCES "public"."developer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_access_requests" ADD CONSTRAINT "developer_access_requests_scopeId_developer_access_scopes_id_fk" FOREIGN KEY ("scopeId") REFERENCES "public"."developer_access_scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_access_requests" ADD CONSTRAINT "developer_access_requests_reviewedByUserId_users_id_fk" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_access_scopes" ADD CONSTRAINT "developer_access_scopes_developerId_developer_profiles_id_fk" FOREIGN KEY ("developerId") REFERENCES "public"."developer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_access_scopes" ADD CONSTRAINT "developer_access_scopes_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_agreements" ADD CONSTRAINT "developer_agreements_developerId_developer_profiles_id_fk" FOREIGN KEY ("developerId") REFERENCES "public"."developer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_audit" ADD CONSTRAINT "developer_audit_developerId_developer_profiles_id_fk" FOREIGN KEY ("developerId") REFERENCES "public"."developer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_messages" ADD CONSTRAINT "developer_messages_developerId_developer_profiles_id_fk" FOREIGN KEY ("developerId") REFERENCES "public"."developer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_notifications" ADD CONSTRAINT "developer_notifications_developerId_developer_profiles_id_fk" FOREIGN KEY ("developerId") REFERENCES "public"."developer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_profiles" ADD CONSTRAINT "developer_profiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_profiles" ADD CONSTRAINT "developer_profiles_applicationId_dev_applications_id_fk" FOREIGN KEY ("applicationId") REFERENCES "public"."dev_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_profiles" ADD CONSTRAINT "developer_profiles_approvedByUserId_users_id_fk" FOREIGN KEY ("approvedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_project_assignments" ADD CONSTRAINT "developer_project_assignments_projectId_developer_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."developer_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_project_assignments" ADD CONSTRAINT "developer_project_assignments_developerId_developer_profiles_id_fk" FOREIGN KEY ("developerId") REFERENCES "public"."developer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_project_assignments" ADD CONSTRAINT "developer_project_assignments_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_project_files" ADD CONSTRAINT "developer_project_files_projectId_developer_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."developer_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_project_files" ADD CONSTRAINT "developer_project_files_uploadedByUserId_users_id_fk" FOREIGN KEY ("uploadedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_projects" ADD CONSTRAINT "developer_projects_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_security_events" ADD CONSTRAINT "developer_security_events_developerId_developer_profiles_id_fk" FOREIGN KEY ("developerId") REFERENCES "public"."developer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_security_events" ADD CONSTRAINT "developer_security_events_acknowledgedByUserId_users_id_fk" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_submissions" ADD CONSTRAINT "developer_submissions_projectId_developer_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."developer_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_submissions" ADD CONSTRAINT "developer_submissions_developerId_developer_profiles_id_fk" FOREIGN KEY ("developerId") REFERENCES "public"."developer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_submissions" ADD CONSTRAINT "developer_submissions_reviewedByUserId_users_id_fk" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_support_tickets" ADD CONSTRAINT "developer_support_tickets_developerId_developer_profiles_id_fk" FOREIGN KEY ("developerId") REFERENCES "public"."developer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_task_assignments" ADD CONSTRAINT "developer_task_assignments_taskId_developer_tasks_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."developer_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_task_assignments" ADD CONSTRAINT "developer_task_assignments_developerId_developer_profiles_id_fk" FOREIGN KEY ("developerId") REFERENCES "public"."developer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_tasks" ADD CONSTRAINT "developer_tasks_projectId_developer_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."developer_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_tasks" ADD CONSTRAINT "developer_tasks_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecosystem_click_events" ADD CONSTRAINT "ecosystem_click_events_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecosystem_proposal_requests" ADD CONSTRAINT "ecosystem_proposal_requests_leadId_leads_id_fk" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acknowledgements" ADD CONSTRAINT "legal_acknowledgements_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acknowledgements" ADD CONSTRAINT "legal_acknowledgements_versionId_agreement_versions_id_fk" FOREIGN KEY ("versionId") REFERENCES "public"."agreement_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_audit" ADD CONSTRAINT "login_audit_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_challenges" ADD CONSTRAINT "mfa_challenges_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_challenges" ADD CONSTRAINT "mfa_challenges_factorId_mfa_factors_id_fk" FOREIGN KEY ("factorId") REFERENCES "public"."mfa_factors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agreement_acceptances_user_id_idx" ON "agreement_acceptances" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "agreement_acceptances_version_id_idx" ON "agreement_acceptances" USING btree ("versionId");--> statement-breakpoint
CREATE INDEX "agreement_versions_document_id_idx" ON "agreement_versions" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX "ai_scans_lead_id_idx" ON "ai_scans" USING btree ("leadId");--> statement-breakpoint
CREATE INDEX "ai_scans_status_idx" ON "ai_scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_answers_booking_id_idx" ON "booking_answers" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "booking_audit_booking_id_idx" ON "booking_audit" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "booking_events_booking_id_idx" ON "booking_events" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "booking_reminders_booking_id_idx" ON "booking_reminders" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "booking_slots_booking_id_idx" ON "booking_slots" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "booking_slots_status_idx" ON "booking_slots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_documents_organization_id_idx" ON "client_documents" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "client_invoices_organization_id_idx" ON "client_invoices" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "client_invoices_status_idx" ON "client_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_messages_organization_id_idx" ON "client_messages" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "client_notifications_organization_id_idx" ON "client_notifications" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "client_project_milestones_project_id_idx" ON "client_project_milestones" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "client_projects_organization_id_idx" ON "client_projects" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "client_recommendations_organization_id_idx" ON "client_recommendations" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "client_recommendations_report_id_idx" ON "client_recommendations" USING btree ("reportId");--> statement-breakpoint
CREATE INDEX "client_reports_organization_id_idx" ON "client_reports" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "client_support_tickets_organization_id_idx" ON "client_support_tickets" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "client_support_tickets_status_idx" ON "client_support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cookie_consents_user_id_idx" ON "cookie_consents" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "custom_discovery_sessions_lead_id_idx" ON "custom_discovery_sessions" USING btree ("leadId");--> statement-breakpoint
CREATE INDEX "developer_access_requests_developer_id_idx" ON "developer_access_requests" USING btree ("developerId");--> statement-breakpoint
CREATE INDEX "developer_access_scopes_developer_id_idx" ON "developer_access_scopes" USING btree ("developerId");--> statement-breakpoint
CREATE INDEX "developer_agreements_developer_id_idx" ON "developer_agreements" USING btree ("developerId");--> statement-breakpoint
CREATE INDEX "developer_audit_developer_id_idx" ON "developer_audit" USING btree ("developerId");--> statement-breakpoint
CREATE INDEX "developer_messages_developer_id_idx" ON "developer_messages" USING btree ("developerId");--> statement-breakpoint
CREATE INDEX "developer_notifications_developer_id_idx" ON "developer_notifications" USING btree ("developerId");--> statement-breakpoint
CREATE INDEX "developer_profiles_application_id_idx" ON "developer_profiles" USING btree ("applicationId");--> statement-breakpoint
CREATE INDEX "developer_project_assignments_project_id_idx" ON "developer_project_assignments" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "developer_project_assignments_developer_id_idx" ON "developer_project_assignments" USING btree ("developerId");--> statement-breakpoint
CREATE INDEX "developer_project_files_project_id_idx" ON "developer_project_files" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "developer_security_events_developer_id_idx" ON "developer_security_events" USING btree ("developerId");--> statement-breakpoint
CREATE INDEX "developer_security_events_severity_idx" ON "developer_security_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "developer_submissions_project_id_idx" ON "developer_submissions" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "developer_submissions_developer_id_idx" ON "developer_submissions" USING btree ("developerId");--> statement-breakpoint
CREATE INDEX "developer_support_tickets_developer_id_idx" ON "developer_support_tickets" USING btree ("developerId");--> statement-breakpoint
CREATE INDEX "developer_task_assignments_task_id_idx" ON "developer_task_assignments" USING btree ("taskId");--> statement-breakpoint
CREATE INDEX "developer_task_assignments_developer_id_idx" ON "developer_task_assignments" USING btree ("developerId");--> statement-breakpoint
CREATE INDEX "developer_tasks_project_id_idx" ON "developer_tasks" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "developer_tasks_status_idx" ON "developer_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ecosystem_click_events_user_id_idx" ON "ecosystem_click_events" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ecosystem_proposal_requests_lead_id_idx" ON "ecosystem_proposal_requests" USING btree ("leadId");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "legal_acknowledgements_user_id_idx" ON "legal_acknowledgements" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "login_audit_user_id_idx" ON "login_audit" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "mfa_challenges_user_id_idx" ON "mfa_challenges" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "mfa_factors_user_id_idx" ON "mfa_factors" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "mfa_recovery_codes_user_id_idx" ON "mfa_recovery_codes" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "organization_memberships_organization_id_idx" ON "organization_memberships" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_id_idx" ON "organization_memberships" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "users_organization_id_idx" ON "users" USING btree ("organizationId");