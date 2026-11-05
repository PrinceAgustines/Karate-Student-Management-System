import { useEffect, useState } from "react";
import { Plus, Copy, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "../../../shared/components/ui/button";
import { Input } from "../../../shared/components/ui/input";
import { Label } from "../../../shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../shared/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  fetchSystemIds,
  generateSystemIds,
  updateSystemId,
  deleteSystemId,
} from "../../../shared/lib/api";

type GeneratedId = {
  id: number;
  code: string;
  id_type: string;
  status: string;
  assigned_student: number | null;
  assigned_name: string | null;
  assigned_account_name: string | null;
  date_issued: string;
};

export function IDManagement() {
  const [idType, setIdType] = useState("student");
  const [quantity, setQuantity] = useState("1");
  const [systemIds, setSystemIds] = useState<GeneratedId[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIdForDeletion, setSelectedIdForDeletion] = useState<GeneratedId | null>(null);

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

  const handleDeleteId = async () => {
    if (!selectedIdForDeletion) return;
    const id = selectedIdForDeletion.id;
    setProcessingIds((prev) => ({ ...prev, [id]: true }));

    try {
      await deleteSystemId(id);
      toast.success("System ID and associated data deleted");
      setSelectedIdForDeletion(null);
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
                      <span className="inline-flex items-center gap-1 px-3 py-2 rounded text-sm font-medium bg-success/20 text-success">
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
                        onClick={() => setSelectedIdForDeletion(item)}
                        disabled={!!processingIds[item.id]}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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
      <AlertDialog
        open={selectedIdForDeletion !== null}
        onOpenChange={(open) => {
          if (!open && !(selectedIdForDeletion && processingIds[selectedIdForDeletion.id])) {
            setSelectedIdForDeletion(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ID and associated data?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent. The following will be deleted:
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedIdForDeletion && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <p className="font-semibold">
                {selectedIdForDeletion.code}
                {selectedIdForDeletion.assigned_name && ` — ${selectedIdForDeletion.assigned_name}`}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-neutral-700">
                <li>The system ID and its assignment</li>
                {selectedIdForDeletion.assigned_account_name && (
                  <>
                    <li>The associated login account, login history, live-presence data, and submitted bug reports</li>
                    {selectedIdForDeletion.id_type === "parent" && (
                      <li>
                        The parent account and its parent-to-student links; the linked student profiles and their records remain
                      </li>
                    )}
                  </>
                )}
                {selectedIdForDeletion.assigned_student !== null && (
                  <li>
                    The student profile and registration details, contacts, attendance, evaluations,
                    belt and badge progress, notifications, uploaded student photos, and other linked records
                  </li>
                )}
                {!selectedIdForDeletion.assigned_account_name && selectedIdForDeletion.assigned_student === null && (
                  <li>No linked account or student profile data was found</li>
                )}
              </ul>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={!!(selectedIdForDeletion && processingIds[selectedIdForDeletion.id])}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!(selectedIdForDeletion && processingIds[selectedIdForDeletion.id])}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteId();
              }}
            >
              {selectedIdForDeletion && processingIds[selectedIdForDeletion.id]
                ? "Deleting..."
                : "Delete ID and data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
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
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm hover:bg-primary/10"
          >
            Student IDs
          </TabsTrigger>
          <TabsTrigger
            value="instructor"
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm hover:bg-primary/10"
          >
            Instructor IDs
          </TabsTrigger>
          <TabsTrigger
            value="admin"
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm hover:bg-primary/10"
          >
            Admin IDs
          </TabsTrigger>
          <TabsTrigger
            value="parent"
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm hover:bg-primary/10"
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
