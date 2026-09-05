"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RoleItem = {
  code: string;
  name: string;
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
  branches: string[];
};

const BRANCHES = [
  "CMR MERKEZ",
  "CMR CADDE",
  "CMR KAPAKLI",
  "CMR SARAY",
  "VODAFONE KANALI",
  "ZUMAY KANALI",
];

const ROLE_OPTIONS = [
  {
    code: "personel",
    name: "Personel",
    desc: "Mağaza/personel hesabı",
  },
  {
    code: "yonetici",
    name: "Yönetici",
    desc: "Yetkileri Super Admin tarafından belirlenir",
  },
  {
    code: "super_admin",
    name: "Super Admin",
    desc: "Sistemde tam yetki — en fazla 2 aktif hesap",
  },
];

function roleLabel(user: UserItem) {
  if (user.roles.some((r) => r.code === "super_admin")) return "Super Admin";
  if (user.roles.some((r) => r.code === "yonetici")) return "Yönetici";
  if (user.roles.some((r) => r.code === "personel")) return "Personel";
  return "Rol Atanmamış";
}

function roleBadgeClass(user: UserItem) {
  if (user.roles.some((r) => r.code === "super_admin")) {
    return "bg-violet-100 text-violet-700 border-violet-200";
  }

  if (user.roles.some((r) => r.code === "yonetici")) {
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
  const [usersLoading, setUsersLoading] = useState(false);

  const [maxSuperAdmins, setMaxSuperAdmins] = useState(2);
  const [activeSuperAdmins, setActiveSuperAdmins] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleCode, setRoleCode] = useState("personel");
  const [branch, setBranch] = useState("CMR MERKEZ");
  const [branches, setBranches] = useState<string[]>(["CMR MERKEZ"]);

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
          u.roles.some(
            (r) => r.code === "yonetici" || r.code === "super_admin"
          )
      ).length,
    [users]
  );

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
    setShowPassword(false);
  };

  const openForm = () => {
    resetForm();
    setMessage(null);
    setFormOpen(true);
  };

  const changeMainBranch = (value: string) => {
    setBranch(value);

    setBranches((current) => {
      if (current.includes(value)) return current;
      return [...current, value];
    });
  };

  const toggleBranch = (value: string) => {
    setBranches((current) => {
      if (value === branch) {
        return current.includes(value) ? current : [...current, value];
      }

      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }

      return [...current, value];
    });
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

    if (roleCode === "super_admin" && activeSuperAdmins >= maxSuperAdmins) {
      setMessage({
        type: "error",
        text: `En fazla ${maxSuperAdmins} aktif Super Admin hesabı olabilir.`,
      });
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      setFormOpen(false);
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
            className="mt-6 w-full h-11 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
          >
            Panele Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-30 bg-[#172033] text-white shadow-lg">
        <div className="max-w-[1500px] mx-auto h-[68px] px-5 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              title="Panele dön"
            >
              ←
            </button>

            <div>
              <div className="font-black tracking-tight text-xl">
                CNETMOBİL
              </div>
              <div className="text-[11px] text-slate-300">
                Super Admin • Kullanıcı Yönetimi
              </div>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-400">Oturum</div>
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
              Kullanıcılar
            </h1>
            <p className="text-slate-500 mt-2 max-w-2xl">
              Personel, yönetici ve Super Admin hesaplarını tek merkezden
              oluşturun. Rol ve detaylı yetki yönetimini bu ekranın devamında
              bağlayacağız.
            </p>
          </div>

          <button
            onClick={openForm}
            className="h-12 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2"
          >
            <span className="text-xl leading-none">+</span>
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
          <div className="px-5 lg:px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black">Kullanıcı Listesi</h2>
              <p className="text-sm text-slate-500">
                Sistemde kayıtlı hesaplar
              </p>
            </div>

            <button
              onClick={loadUsers}
              disabled={usersLoading}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm disabled:opacity-50"
            >
              {usersLoading ? "Yenileniyor..." : "Yenile"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Kullanıcı</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Ana Şube</th>
                  <th className="px-6 py-4">Erişim</th>
                  <th className="px-6 py-4">Durum</th>
                  <th className="px-6 py-4">Son Giriş</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-5">
                      <div className="font-black text-slate-900">
                        {user.email || "E-posta yok"}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        ID #{user.id}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center border rounded-full px-3 py-1.5 text-xs font-black ${roleBadgeClass(
                          user
                        )}`}
                      >
                        {roleLabel(user)}
                      </span>
                    </td>

                    <td className="px-6 py-5 font-semibold">
                      {user.branch}
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1.5 max-w-[320px]">
                        {(user.branches || []).map((item) => (
                          <span
                            key={item}
                            className="text-[11px] font-bold bg-slate-100 text-slate-600 rounded-full px-2.5 py-1"
                          >
                            {item}
                          </span>
                        ))}
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
                  </tr>
                ))}

                {!usersLoading && users.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-14 text-center text-slate-400 font-semibold"
                    >
                      Kayıtlı kullanıcı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-[28px] shadow-2xl border border-white">
            <div className="p-6 lg:p-7 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black text-blue-600 uppercase tracking-widest">
                  Super Admin
                </div>
                <h2 className="text-2xl font-black mt-1">
                  Yeni Kullanıcı Oluştur
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Hesap e-posta ve şifre ile giriş yapacak.
                </p>
              </div>

              <button
                onClick={() => setFormOpen(false)}
                disabled={saving}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 lg:p-7 space-y-6">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">
                  E-posta
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="ornek@cnetmobil.com.tr"
                  className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 outline-none focus:bg-white focus:border-blue-500 transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="text-sm font-black text-slate-700">
                    Geçici Şifre
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-xs font-black text-blue-600 hover:text-blue-700"
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
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 pr-14 outline-none focus:bg-white focus:border-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500"
                  >
                    {showPassword ? "Gizle" : "Göster"}
                  </button>
                </div>

                <p className="text-xs text-slate-400 mt-2">
                  En az 8 karakter, büyük harf, küçük harf ve rakam.
                </p>
              </div>

              <div>
                <label className="block text-sm font-black text-slate-700 mb-3">
                  Rol
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {ROLE_OPTIONS.map((role) => {
                    const disabled =
                      role.code === "super_admin" &&
                      activeSuperAdmins >= maxSuperAdmins;

                    return (
                      <button
                        key={role.code}
                        type="button"
                        disabled={disabled}
                        onClick={() => setRoleCode(role.code)}
                        className={`text-left rounded-2xl border p-4 transition ${
                          roleCode === role.code
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        <div className="font-black">{role.name}</div>
                        <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {role.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">
                  Ana Şube
                </label>

                <select
                  value={branch}
                  onChange={(e) => changeMainBranch(e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 outline-none focus:bg-white focus:border-blue-500"
                >
                  {BRANCHES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-black text-slate-700 mb-3">
                  Erişebileceği Şubeler
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        <div className="flex-1">
                          <div className="font-bold text-sm">{item}</div>
                          {isMain && (
                            <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider">
                              Ana Şube
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {roleCode === "super_admin" && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
                  <strong>Super Admin:</strong> Sistemdeki tüm aktif yetkilere
                  otomatik sahip olur. Aktif hesap sınırı {maxSuperAdmins}.
                </div>
              )}
            </div>

            <div className="p-6 lg:p-7 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                onClick={() => setFormOpen(false)}
                disabled={saving}
                className="h-12 px-6 rounded-xl border border-slate-200 font-black hover:bg-slate-50"
              >
                Vazgeç
              </button>

              <button
                onClick={createUser}
                disabled={saving}
                className="h-12 px-7 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {saving ? "Oluşturuluyor..." : "Kullanıcıyı Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
