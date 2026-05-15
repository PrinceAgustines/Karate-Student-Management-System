import { useEffect, useState } from "react";
import { useAuth } from "../../../auth";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { fetchMe, updateMe } from "../../../api";

type ParentProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
};

export function ParentProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ParentProfileForm>({ first_name: "", last_name: "", email: "" });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchMe()
      .then((data) => {
        setForm({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
        });
      })
      .catch(() => {
        setForm({ first_name: "", last_name: "", email: "" });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateMe({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
      });
      setForm({
        first_name: updated.first_name || "",
        last_name: updated.last_name || "",
        email: updated.email || "",
      });
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Parent Profile</h1>
        <p className="text-sm text-neutral-500">Manage your account information and contact details.</p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        {loading ? (
          <div className="text-sm text-neutral-500">Loading profile...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2">First Name</label>
                <Input
                  value={form.first_name}
                  onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2">Last Name</label>
                <Input
                  value={form.last_name}
                  onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2">Email</label>
                <Input
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  type="email"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </Button>
              {message && <span className="text-sm text-neutral-500">{message}</span>}
            </div>
            <div className="text-xs text-neutral-500">Your parent account is used to manage profile settings and access your child or children’s progress.</div>
          </div>
        )}
      </div>
    </div>
  );
}
