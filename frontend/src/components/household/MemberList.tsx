import { useEffect, useState } from "react";
import { getMembers, updateMember, removeMember } from "@/api/households";
import { useHousehold } from "@/contexts/HouseholdContext";
import { UserMinus } from "lucide-react";
import type { HouseholdMember } from "@/types";

export function MemberList() {
  const { household } = useHousehold();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canManage =
    household?.my_role === "owner" || household?.my_role === "admin";
  const isOwner = household?.my_role === "owner";

  useEffect(() => {
    getMembers()
      .then((res) => setMembers(res.data))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleRoleChange(member: HouseholdMember, role: string) {
    try {
      const res = await updateMember(member.id, { role });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? res.data : m))
      );
    } catch {
      // ignore
    }
  }

  async function handleGroceryPermissionChange(
    member: HouseholdMember,
    grocery_permission: string
  ) {
    try {
      const res = await updateMember(member.id, { grocery_permission });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? res.data : m))
      );
    } catch {
      // ignore
    }
  }

  async function handleRemove(member: HouseholdMember) {
    if (!confirm(`Remove ${member.user.name} from the household?`)) return;
    try {
      await removeMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch {
      // ignore
    }
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading members...</p>;
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div
          key={member.id}
          className="rounded-lg border border-gray-200 p-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {member.user.name}
                {member.is_me && (
                  <span className="ml-1 text-xs text-gray-400">(you)</span>
                )}
              </p>
              <p className="text-xs text-gray-500">{member.user.email}</p>
            </div>

            {canManage && !member.is_me && member.role !== "owner" && (
              <button
                onClick={() => handleRemove(member)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                title="Remove member"
              >
                <UserMinus className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-2 flex gap-3">
            {isOwner && !member.is_me && member.role !== "owner" ? (
              <div className="flex-1">
                <label className="text-xs text-gray-500">Role</label>
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member, e.target.value)}
                  className="mt-0.5 block w-full rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
              </div>
            ) : (
              <div className="flex-1">
                <label className="text-xs text-gray-500">Role</label>
                <p className="mt-0.5 text-xs capitalize text-gray-700">
                  {member.role}
                </p>
              </div>
            )}

            {canManage && !member.is_me && member.role !== "owner" ? (
              <div className="flex-1">
                <label className="text-xs text-gray-500">Grocery access</label>
                <select
                  value={member.grocery_permission}
                  onChange={(e) =>
                    handleGroceryPermissionChange(member, e.target.value)
                  }
                  className="mt-0.5 block w-full rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-garnish-500 focus:outline-none focus:ring-1 focus:ring-garnish-500"
                >
                  <option value="full">Full access</option>
                  <option value="contribute">Add only</option>
                  <option value="read">View only</option>
                </select>
              </div>
            ) : (
              <div className="flex-1">
                <label className="text-xs text-gray-500">Grocery access</label>
                <p className="mt-0.5 text-xs capitalize text-gray-700">
                  {member.grocery_permission === "full"
                    ? "Full access"
                    : member.grocery_permission === "contribute"
                      ? "Add only"
                      : "View only"}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
