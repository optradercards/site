"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Admin {
  user_id: string;
  email: string;
  role: "admin" | "super_admin";
  full_name: string | null;
  created_at: string;
}

interface AdminsManagerProps {
  admins: Admin[];
  isSuperAdmin: boolean;
  currentUserId: string;
}

export default function AdminsManager({
  admins,
  isSuperAdmin,
  currentUserId,
}: AdminsManagerProps) {
  const router = useRouter();
  const supabase = createClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<{
    user_id: string;
    email: string;
    full_name: string | null;
  } | null>(null);
  const [suggestions, setSuggestions] = useState<
    { user_id: string; email: string; full_name: string | null }[]
  >([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [role, setRole] = useState<"admin" | "super_admin">("admin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchUsers = useCallback(
    async (term: string) => {
      if (term.length < 3) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase.rpc("find_user_by_email", {
          lookup_email: term,
        });
        if (error) throw error;
        setSuggestions(data ?? []);
        setShowDropdown(true);
      } catch (error: any) {
        console.error("Search error:", error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [supabase]
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedUser(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(value.trim()), 300);
  }

  function handleSelectUser(user: {
    user_id: string;
    email: string;
    full_name: string | null;
  }) {
    setSelectedUser(user);
    setQuery(user.email);
    setSuggestions([]);
    setShowDropdown(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) {
      toast.error("Please select a user from the search results");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: roleError } = await supabase.rpc("set_platform_role", {
        target_user_id: selectedUser.user_id,
        new_role: role,
      });

      if (roleError) throw roleError;

      toast.success(
        `${selectedUser.email} added as ${role.replace("_", " ")}`
      );
      setQuery("");
      setSelectedUser(null);
      setShowAddForm(false);
      router.refresh();
    } catch (error: any) {
      console.error("Error adding admin:", error);
      toast.error(error.message || "Failed to add admin");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(targetUserId: string, targetEmail: string) {
    if (!confirm(`Remove ${targetEmail} as an admin?`)) return;

    setRemovingId(targetUserId);
    try {
      const { error } = await supabase.rpc("remove_platform_role", {
        target_user_id: targetUserId,
      });

      if (error) throw error;

      toast.success(`${targetEmail} removed`);
      router.refresh();
    } catch (error: any) {
      console.error("Error removing admin:", error);
      toast.error(error.message || "Failed to remove admin");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Admins
        </h2>
        {isSuperAdmin && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded transition-colors"
          >
            {showAddForm ? "Cancel" : "Add Admin"}
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Admin
          </h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1" ref={dropdownRef}>
              <input
                type="text"
                placeholder="Search by email (min 3 chars)"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0 && !selectedUser)
                    setShowDropdown(true);
                }}
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {showDropdown && (
                <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-auto">
                  {isSearching ? (
                    <li className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      Searching...
                    </li>
                  ) : suggestions.length === 0 ? (
                    <li className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      No users found
                    </li>
                  ) : (
                    suggestions.map((user) => (
                      <li
                        key={user.user_id}
                        onClick={() => handleSelectUser(user)}
                        className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        <div className="text-sm text-gray-900 dark:text-white">
                          {user.email}
                        </div>
                        {user.full_name && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {user.full_name}
                          </div>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "admin" | "super_admin")
              }
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <button
              type="submit"
              disabled={isSubmitting || !selectedUser}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-semibold rounded transition-colors"
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Name
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Email
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Role
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Added on
              </th>
              {isSuperAdmin && (
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td
                  colSpan={isSuperAdmin ? 5 : 4}
                  className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  No admins found.
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr
                  key={admin.user_id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {admin.full_name || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {admin.email}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        admin.role === "super_admin"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}
                    >
                      {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(admin.created_at).toLocaleDateString()}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-6 py-4 text-sm">
                      {admin.user_id === currentUserId ? (
                        <span className="text-gray-400 text-xs">You</span>
                      ) : (
                        <button
                          onClick={() =>
                            handleRemove(admin.user_id, admin.email)
                          }
                          disabled={removingId === admin.user_id}
                          className="text-red-500 hover:text-red-600 disabled:text-gray-400 font-semibold"
                        >
                          {removingId === admin.user_id
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
