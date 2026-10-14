-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- Insert default roles
INSERT INTO "roles" ("id", "name") VALUES (1, 'admin');
INSERT INTO "roles" ("id", "name") VALUES (2, 'user');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "roleId" INTEGER NOT NULL DEFAULT 2;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
