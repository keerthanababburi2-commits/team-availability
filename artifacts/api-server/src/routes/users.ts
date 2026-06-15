import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, teamMembersTable } from "@workspace/db";
import {
  ListUsersResponse,
  CreateUserBody,
  GetUserParams,
  GetUserResponse,
  DeleteUserParams,
  UpdateAvailabilityParams,
  UpdateAvailabilityBody,
  UpdateAvailabilityResponse,
  GetStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeMember(m: typeof teamMembersTable.$inferSelect) {
  return {
    ...m,
    createdAt: m.createdAt.toISOString(),
    availabilityUpdatedAt: m.availabilityUpdatedAt.toISOString(),
  };
}

router.get("/users", async (req, res): Promise<void> => {
  req.log.info("Listing team members");
  const members = await db
    .select()
    .from(teamMembersTable)
    .orderBy(teamMembersTable.createdAt);
  res.json(ListUsersResponse.parse(members.map(serializeMember)));
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid request body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [member] = await db
    .insert(teamMembersTable)
    .values({
      name: parsed.data.name,
      role: parsed.data.role,
      department: parsed.data.department ?? null,
      statusNote: parsed.data.statusNote ?? null,
      available: parsed.data.available ?? true,
      avatarColor: parsed.data.avatarColor ?? null,
      availabilityUpdatedAt: new Date(),
    })
    .returning();

  res.status(201).json(GetUserResponse.parse(serializeMember(member)));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [member] = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.id, params.data.id));

  if (!member) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  res.json(GetUserResponse.parse(serializeMember(member)));
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(teamMembersTable)
    .where(eq(teamMembersTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/users/:id/availability", async (req, res): Promise<void> => {
  const params = UpdateAvailabilityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAvailabilityBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid request body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof teamMembersTable.$inferInsert> = {
    available: parsed.data.available,
    availabilityUpdatedAt: new Date(),
  };

  if (parsed.data.statusNote !== undefined) {
    updateData.statusNote = parsed.data.statusNote;
  }

  const [member] = await db
    .update(teamMembersTable)
    .set(updateData)
    .where(eq(teamMembersTable.id, params.data.id))
    .returning();

  if (!member) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  res.json(UpdateAvailabilityResponse.parse(serializeMember(member)));
});

router.get("/stats", async (req, res): Promise<void> => {
  req.log.info("Fetching team stats");
  const members = await db.select().from(teamMembersTable);
  const total = members.length;
  const available = members.filter((m) => m.available).length;
  const unavailable = total - available;

  res.json(GetStatsResponse.parse({ total, available, unavailable }));
});

export default router;
