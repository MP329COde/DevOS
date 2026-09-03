CREATE TABLE "gitlab_issue_links" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "gitlab_project_id" VARCHAR(100) NOT NULL,
    "issue_iid" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "gitlab_issue_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gitlab_issue_links_gitlab_project_id_issue_iid_key" ON "gitlab_issue_links"("gitlab_project_id", "issue_iid");
CREATE UNIQUE INDEX "gitlab_issue_links_item_id_gitlab_project_id_key" ON "gitlab_issue_links"("item_id", "gitlab_project_id");
ALTER TABLE "gitlab_issue_links" ADD CONSTRAINT "gitlab_issue_links_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;