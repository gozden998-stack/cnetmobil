"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RoleItem = {
  code: string;
  name: string;
  description?: string | null;
};

type PermissionItem = {
  code: string;
  name: string;
  module: string;
  description?: string | null;
};

type UserItem = {
  id: number;
  username: string | null;
  email: string | null;
  branch: string;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastLoginAt?: string | null;
  roles: RoleItem[];
  roleCode: string | null;
  branches: string[];
  effectivePermissions: string[];
};

const BRANCHES = [
  "CMR MERKEZ",
  "CMR CADDE",
  "CMR KAPAKLI",
  "CMR SARAY",
  "VODAFONE KANALI",
  "ZUMAY KANALI",
];

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Kullanıcılar",
  roles: "Rol & Yetki",
  branches: "Mağazalar",
  devices: "Cihazlar",
  prices: "Fiyat Yönetimi",
  stock: "Stok",
  requests: "Cihaz Talepleri",
  purchases: "Alımlar",
  thh: "THH",
  reports: "Raporlar",
  settings: "Sistem Ayarları",
  audit: "İşlem Geçmişi",
};

function roleLabel(user: UserItem) {
  if (user.roleCode === "super_admin") return "Super Admin";
  if (user.roleCode === "yonetici") return "Yönetici";
  if (user.roleCode === "personel") return "Personel";
  return "Rol Atanmamış";
}

function roleBadgeClass(user: UserItem) {
  if (user.roleCode === "super_admin") {
    return "bg-violet-100 text-violet-700 border-violet-200";
  }
  if (user.roleCode === "yonetici") {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function SuperAdminUsersPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [meEmail, setMeEmail] = useState("");

  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [maxSuperAdmins, setMaxSuperAdmins] = useState(2);
  const [activeSuperAdmins, setActiveSuperAdmins] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleCode, setRoleCode] = useState("personel");
  const [branch, setBranch] = useState("CMR MERKEZ");
  const [branches, setBranches] = useState<string[]>(["CMR MERKEZ"]);
  const [active, setActive] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set()
  );

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const activeUsers = useMemo(
    () => users.filter((u) => u.active).length,
    [users]
  );

  const managerCount = useMemo(
    () =>
      users.filter(
        (u) =>
          u.active &&
          (u.roleCode === "yonetici" || u.roleCode === "super_admin")
      ).length,
    [users]
  );

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionItem[]>();

    permissionCatalog.forEach((permission) => {
      if (!map.has(permission.module)) map.set(permission.module, []);
      map.get(permission.module)!.push(permission);
    });

    return Array.from(map.entries());
  }, [permissionCatalog]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return users;

    return users.filter((user) => {
      const haystack = [
        user.email || "",
        user.branch || "",
        roleLabel(user),
        ...(user.branches || []),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [users, search]);

  const loadUsers = async () => {
    setUsersLoading(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Kullanıcılar alınamadı.");
      }

      setUsers(Array.isArray(data.users) ? data.users : []);
      setRoles(Array.isArray(data.roles) ? data.roles : []);
      setPermissionCatalog(
        Array.isArray(data.permissions) ? data.permissions : []
      );
      setMaxSuperAdmins(Number(data?.limits?.maxActiveSuperAdmins || 2));
      setActiveSuperAdmins(Number(data?.limits?.activeSuperAdmins || 0));
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Kullanıcılar alınamadı.",
      });
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        const res = await fetch("/api/me", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          router.replace("/");
          return;
        }

        if (!data.isSuperAdmin) {
          setIsSuperAdmin(false);
          setAuthLoading(false);
          return;
        }

        setIsSuperAdmin(true);
        setMeEmail(data?.user?.email || "");
        await loadUsers();
      } catch {
        router.replace("/");
        return;
      }

      setAuthLoading(false);
    };

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setRoleCode("personel");
    setBranch("CMR MERKEZ");
    setBranches(["CMR MERKEZ"]);
    setActive(true);
    setSelectedPermissions(new Set());
    setShowPassword(false);
  };

  const openCreate = () => {
    resetForm();
    setMessage(null);
    setCreateOpen(true);
  };

  const openEdit = (user: UserItem) => {
    setMessage(null);
    setEditUser(user);
    setEmail(user.email || "");
    setPassword("");
    setRoleCode(user.roleCode || "personel");
    setBranch(user.branch || "CMR MERKEZ");
    setBranches(
      user.branches?.length ? [...user.branches] : [user.branch || "CMR MERKEZ"]
    );
    setActive(user.active);
    setSelectedPermissions(new Set(user.effectivePermissions || []));
    setShowPassword(false);
  };

  const closeModals = () => {
    if (saving) return;
    setCreateOpen(false);
    setEditUser(null);
    resetForm();
  };

  const changeMainBranch = (value: string) => {
    setBranch(value);
    setBranches((current) =>
      current.includes(value) ? current : [...current, value]
    );
  };

  const toggleBranch = (value: string) => {
    setBranches((current) => {
      if (value === branch) {
        return current.includes(value) ? current : [...current, value];
      }
      return current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
    });
  };

  const togglePermission = (code: string) => {
    if (roleCode === "super_admin") return;

    setSelectedPermissions((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const setAllPermissions = (checked: boolean) => {
    if (roleCode === "super_admin") return;
    setSelectedPermissions(
      checked
        ? new Set(permissionCatalog.map((permission) => permission.code))
        : new Set()
    );
  };

  const generatePassword = () => {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const nums = "23456789";
    const symbols = "!@#$%";
    const all = upper + lower + nums + symbols;

    const random = (pool: string) => {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return pool[array[0] % pool.length];
    };

    const chars = [
      random(upper),
      random(lower),
      random(nums),
      random(symbols),
    ];

    for (let i = chars.length; i < 12; i++) {
      chars.push(random(all));
    }

    for (let i = chars.length - 1; i > 0; i--) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      const j = array[0] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    setPassword(chars.join(""));
    setShowPassword(true);
  };

  const createUser = async () => {
    setMessage(null);

    if (!email.trim()) {
      setMessage({ type: "error", text: "E-posta adresi gerekli." });
      return;
    }

    if (!password) {
      setMessage({ type: "error", text: "Şifre gerekli." });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          roleCode,
          branch,
          branches,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Kullanıcı oluşturulamadı.");
      }

      setMessage({
        type: "success",
        text: `${email.trim()} hesabı başarıyla oluşturuldu.`,
      });

      setCreateOpen(false);
      resetForm();
      await loadUsers();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Kullanıcı oluşturulamadı.",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editUser) return;

    setMessage(null);
    setSaving(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editUser.id,
          email: email.trim(),
          roleCode,
          branch,
          branches,
          active,
          permissions: Array.from(selectedPermissions),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Kullanıcı güncellenemedi.");
      }

      setMessage({
        type: "success",
        text: `${email.trim()} hesabının ayarları kaydedildi.`,
      });

      setEditUser(null);
      resetForm();
      await loadUsers();
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Kullanıcı güncellenemedi.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-11 h-11 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
          <div className="text-sm font-semibold text-slate-500">
            Yetkiler kontrol ediliyor...
          </div>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl bg-white border border-slate-200 shadow-xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 mx-auto flex items-center justify-center text-2xl mb-5">
            🔒
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            Yetkiniz Bulunmuyor
          </h1>
          <p className="text-slate-500 mt-3">
            Kullanıcı yönetimi yalnızca Super Admin hesapları tarafından
            kullanılabilir.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 w-full h-11 rounded-xl bg-slate-900 text-white font-bold"
          >
            Panele Dön
          </button>
        </div>
      </div>
    );
  }

  const modalOpen = createOpen || Boolean(editUser);
  const isEditing = Boolean(editUser);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-30 bg-[#172033] text-white shadow-lg">
        <div className="max-w-[1500px] mx-auto h-[68px] px-5 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
            >
              ←
            </button>
            <div>
              <div className="font-black tracking-tight text-xl">CNETMOBİL</div>
              <div className="text-[11px] text-slate-300">
                Super Admin • Kullanıcı & Yetki Yönetimi
              </div>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-400">Super Admin</div>
            <div className="text-sm font-semibold">{meEmail}</div>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto p-5 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-7">
          <div>
            <div className="text-sm font-bold text-blue-600 uppercase tracking-wider">
              Yönetim Merkezi
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight mt-1">
              Kullanıcılar & Yetkiler
            </h1>
            <p className="text-slate-500 mt-2 max-w-3xl">
              E-posta, rol, aktiflik, mağaza erişimi ve işlem yetkilerini
              buradan yönetin. Yetki değişiklikleri için artık kod veya deploy
              gerekmiyor.
            </p>
          </div>

          <button
            onClick={openCreate}
            className="h-12 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            <span className="text-xl">+</span>
            Yeni Kullanıcı
          </button>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-2xl border px-5 py-4 font-semibold ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">
          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6">
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              Toplam Kullanıcı
            </div>
            <div className="text-4xl font-black mt-3">{users.length}</div>
          </div>

          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6">
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              Aktif Kullanıcı
            </div>
            <div className="text-4xl font-black mt-3">{activeUsers}</div>
          </div>

          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6">
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              Yönetici / Super Admin
            </div>
            <div className="flex items-end justify-between gap-3 mt-3">
              <div className="text-4xl font-black">{managerCount}</div>
              <div className="text-xs font-bold text-violet-700 bg-violet-50 border border-violet-100 rounded-full px-3 py-1.5">
                Super Admin {activeSuperAdmins}/{maxSuperAdmins}
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 lg:px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black">Kullanıcı Listesi</h2>
              <p className="text-sm text-slate-500">
                Bir kullanıcıyı düzenlemek için satırdaki Düzenle'ye basın.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="E-posta, rol veya şube ara..."
                className="h-10 w-full md:w-[290px] rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-500"
              />
              <button
                onClick={loadUsers}
                disabled={usersLoading}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm disabled:opacity-50"
              >
                {usersLoading ? "..." : "Yenile"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Kullanıcı</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Ana Şube</th>
                  <th className="px-6 py-4">Yetki</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4">Son Giriş</th>
                  <th className="px-6 py-4 text-right">İşlem</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-5">
                      <div className="font-black">
                        {user.email || "E-posta yok"}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        ID #{user.id}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex border rounded-full px-3 py-1.5 text-xs font-black ${roleBadgeClass(
                          user
                        )}`}
                      >
                        {roleLabel(user)}
                      </span>
                    </td>

                    <td className="px-6 py-5 font-semibold">{user.branch}</td>

                    <td className="px-6 py-5">
                      <div className="font-black text-sm">
                        {user.roleCode === "super_admin"
                          ? "Tümü"
                          : user.effectivePermissions?.length || 0}
                      </div>
                      <div className="text-xs text-slate-400">
                        {user.roleCode === "super_admin"
                          ? "Tam yetki"
                          : "aktif yetki"}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${
                          user.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {user.active ? "Aktif" : "Pasif"}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-sm text-slate-500">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString("tr-TR")
                        : "Henüz giriş yok"}
                    </td>

                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => openEdit(user)}
                        className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black"
                      >
                        Düzenle
                      </button>
                    </td>
                  </tr>
                ))}

                {!usersLoading && filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-14 text-center text-slate-400 font-semibold"
                    >
                      Kullanıcı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-5xl max-h-[94vh] overflow-y-auto bg-white rounded-[28px] shadow-2xl">
            <div className="p-6 lg:p-7 border-b border-slate-100 flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
              <div>
                <div className="text-xs font-black text-blue-600 uppercase tracking-widest">
                  {isEditing ? "Kullanıcı Ayarları" : "Yeni Kullanıcı"}
                </div>
                <h2 className="text-2xl font-black mt-1">
                  {isEditing
                    ? editUser?.email || "Kullanıcı Düzenle"
                    : "Yeni Kullanıcı Oluştur"}
                </h2>
              </div>

              <button
                onClick={closeModals}
                disabled={saving}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 lg:p-7 space-y-7">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-black mb-2">
                    E-posta
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="kullanici@cnetmobil.com.tr"
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>

                {!isEditing && (
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <label className="text-sm font-black">Geçici Şifre</label>
                      <button
                        type="button"
                        onClick={generatePassword}
                        className="text-xs font-black text-blue-600"
                      >
                        Güçlü Şifre Oluştur
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type={showPassword ? "text" : "password"}
                        placeholder="En az 8 karakter"
                        className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 pr-14 outline-none focus:bg-white focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500"
                      >
                        {showPassword ? "Gizle" : "Göster"}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-black mb-2">Rol</label>
                  <select
                    value={roleCode}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      setRoleCode(nextRole);

                      if (nextRole === "super_admin") {
                        setSelectedPermissions(
                          new Set(permissionCatalog.map((p) => p.code))
                        );
                      }
                    }}
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4"
                  >
                    {roles.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-black mb-2">
                    Ana Şube
                  </label>
                  <select
                    value={branch}
                    onChange={(e) => changeMainBranch(e.target.value)}
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4"
                  >
                    {BRANCHES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isEditing && (
                <div className="rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-black">Hesap Durumu</div>
                    <div className="text-sm text-slate-500 mt-1">
                      Pasif kullanıcı giriş yapamaz ve API erişimi kesilir.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActive((v) => !v)}
                    className={`w-[82px] h-10 rounded-full p-1 transition ${
                      active ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 bg-white rounded-full shadow transition-transform ${
                        active ? "translate-x-10" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-black mb-3">
                  Erişebileceği Şubeler
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {BRANCHES.map((item) => {
                    const checked = branches.includes(item);
                    const isMain = item === branch;

                    return (
                      <label
                        key={item}
                        className={`rounded-xl border px-4 py-3 flex items-center gap-3 cursor-pointer ${
                          checked
                            ? "border-blue-200 bg-blue-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBranch(item)}
                        />
                        <div>
                          <div className="font-bold text-sm">{item}</div>
                          {isMain && (
                            <div className="text-[10px] font-black text-blue-600 uppercase">
                              Ana Şube
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {isEditing && (
                <div>
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
                    <div>
                      <div className="text-sm font-black">İşlem Yetkileri</div>
                      <div className="text-sm text-slate-500 mt-1">
                        Seçimler PostgreSQL'e kaydedilir ve panel API'lerinde
                        anında uygulanır.
                      </div>
                    </div>

                    {roleCode !== "super_admin" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAllPermissions(true)}
                          className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-black hover:bg-slate-50"
                        >
                          Tümünü Seç
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllPermissions(false)}
                          className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-black hover:bg-slate-50"
                        >
                          Tümünü Kaldır
                        </button>
                      </div>
                    )}
                  </div>

                  {roleCode === "super_admin" && (
                    <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-violet-800 text-sm">
                      <strong>Super Admin tam yetkilidir.</strong> Yeni bir
                      permission eklendiğinde otomatik olarak erişir; tek tek
                      işaretleme gerekmez.
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {groupedPermissions.map(([module, items]) => (
                      <div
                        key={module}
                        className="rounded-2xl border border-slate-200 overflow-hidden"
                      >
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-black">
                          {MODULE_LABELS[module] || module}
                        </div>

                        <div className="divide-y divide-slate-100">
                          {items.map((permission) => {
                            const checked =
                              roleCode === "super_admin" ||
                              selectedPermissions.has(permission.code);

                            return (
                              <label
                                key={permission.code}
                                className={`px-4 py-3 flex items-start gap-3 ${
                                  roleCode === "super_admin"
                                    ? "cursor-default"
                                    : "cursor-pointer hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={roleCode === "super_admin"}
                                  onChange={() =>
                                    togglePermission(permission.code)
                                  }
                                  className="mt-1"
                                />
                                <div>
                                  <div className="font-bold text-sm">
                                    {permission.name}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {permission.code}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 lg:p-7 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={closeModals}
                disabled={saving}
                className="h-12 px-6 rounded-xl border border-slate-200 font-black hover:bg-slate-50"
              >
                Vazgeç
              </button>

              <button
                onClick={isEditing ? saveEdit : createUser}
                disabled={saving}
                className="h-12 px-7 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {saving
                  ? "Kaydediliyor..."
                  : isEditing
                  ? "Değişiklikleri Kaydet"
                  : "Kullanıcıyı Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
