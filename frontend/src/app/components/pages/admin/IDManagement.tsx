import { useEffect, useState } from "react";
import { Plus, Copy, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { toast } from "sonner";
import {
  fetchSystemIds,
  generateSystemIds,
  updateSystemId,
  deleteSystemId,
} from "../../../api";

type GeneratedId = {
  id: number;
  code: string;
  id_type: string;
  status: string;
  assigned_name: string | null;
  date_issued: string;
};

export function IDManagement() {
  const [idType, setIdType] = useState("student");
  const [quantity, setQuantity] = useState("1");
  const [systemIds, setSystemIds] = useState<GeneratedId[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSystemIds = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSystemIds();
      if (Array.isArray(data)) {
        setSystemIds(data);
      }
    } catch {
      setSystemIds([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSystemIds();
  }, []);

  const handleGenerateIds = async () => {
    const quantityValue = Math.max(1, Math.min(100, Number(quantity) || 1));
    setIsSubmitting(true);

    try {
      const newIds = await generateSystemIds({
        id_type: idType,
        quantity: quantityValue,
      });
      toast.success(`Generated ${newIds.length} ${idType} ID(s)`);
      await loadSystemIds();
    } catch (error) {
      toast.error((error as Error).message || "Unable to generate IDs");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard is not available.');
      }
      await navigator.clipboard.writeText(code);
      toast.success("ID copied to clipboard");
    } catch (error) {
      toast.error("Unable to copy ID to clipboard");
    }
  };

  const [processingIds, setProcessingIds] = useState<Record<number, boolean>>({});

  const handleStatusChange = async (id: number, status: string) => {
    setProcessingIds((prev) => ({ ...prev, [id]: true }));

    try {
      await updateSystemId(id, { status });
      toast.success("ID status updated");
      await loadSystemIds();
    } catch (error) {
      toast.error((error as Error).message || "Unable to update ID status");
    } finally {
      setProcessingIds((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDeleteId = async (id: number) => {
    const confirmed = window.confirm("Delete this system ID? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setProcessingIds((prev) => ({ ...prev, [id]: true }));

    try {
      await deleteSystemId(id);
      toast.success("System ID deleted");
      await loadSystemIds();
    } catch (error) {
      toast.error((error as Error).message || "Unable to delete system ID");
    } finally {
      setProcessingIds((prev) => ({ ...prev, [id]: false }));
    }
  };

  const renderIdTable = (type: string) => {
    const filteredIds = systemIds.filter((item) => item.id_type === type);

    return (
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Date Issued</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredIds.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm font-medium">{item.code}</td>
                  <td className="px-6 py-4">
                    {item.status === 'assigned' || item.assigned_name ? (
                      <span className="inline-flex items-center gap-1 px-3 py-2 rounded text-sm font-medium bg-green-50 text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        Assigned
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-2 rounded text-sm font-medium bg-neutral-100 text-neutral-700">
                        Generated
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    {item.assigned_name || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{item.date_issued}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(item.code)}
                        disabled={!!processingIds[item.id]}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteId(item.id)}
                        disabled={!!processingIds[item.id]}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ID Management</h1>
        <p className="text-sm text-neutral-500">Generate and manage system IDs</p>
      </div>

      {/* Generate New IDs */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="font-semibold mb-4">Generate New IDs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="idType">ID Type</Label>
            <Select value={idType} onValueChange={setIdType}>
              <SelectTrigger id="idType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student ID (S-12345)</SelectItem>
                <SelectItem value="instructor">Instructor ID (I-12345)</SelectItem>
                <SelectItem value="admin">Admin ID (A-12345)</SelectItem>
                <SelectItem value="parent">Parent ID (P-12345)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max="100"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleGenerateIds}
              disabled={isSubmitting || isLoading}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Generate IDs
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Student IDs (Total)</div>
          <div className="text-2xl font-semibold">
            {systemIds.filter((item) => item.id_type === "student").length}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Instructor IDs (Total)</div>
          <div className="text-2xl font-semibold">
            {systemIds.filter((item) => item.id_type === "instructor").length}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Admin IDs (Total)</div>
          <div className="text-2xl font-semibold">
            {systemIds.filter((item) => item.id_type === "admin").length}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Parent IDs (Total)</div>
          <div className="text-2xl font-semibold">
            {systemIds.filter((item) => item.id_type === "parent").length}
          </div>
        </div>
      </div>

      {/* ID Lists */}
      <Tabs defaultValue="student" className="space-y-4">
        <TabsList className="bg-white border border-neutral-200 rounded-full p-1 shadow-sm">
          <TabsTrigger
            value="student"
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-red-50"
          >
            Student IDs
          </TabsTrigger>
          <TabsTrigger
            value="instructor"
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-red-50"
          >
            Instructor IDs
          </TabsTrigger>
          <TabsTrigger
            value="admin"
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-red-50"
          >
            Admin IDs
          </TabsTrigger>
          <TabsTrigger
            value="parent"
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-red-50"
          >
            Parent IDs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="student">{renderIdTable("student")}</TabsContent>
        <TabsContent value="instructor">{renderIdTable("instructor")}</TabsContent>
        <TabsContent value="admin">{renderIdTable("admin")}</TabsContent>
        <TabsContent value="parent">{renderIdTable("parent")}</TabsContent>
      </Tabs>
    </div>
  );
}
