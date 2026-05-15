import { useEffect, useState } from "react";
import { Package, Plus, Edit, Trash2, Search } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { Textarea } from "../../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import { useAuth } from "../../../auth";
import {
  fetchInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "../../../api";

type InventoryItem = {
  item_id: number;
  item_name: string;
  category: string;
  quantity: number;
  price: number;
  supplier?: string;
  description?: string;
  image_url?: string;
  borrowed: boolean;
};

type InventoryFormValues = {
  item_name: string;
  category: string;
  quantity: string;
  price: string;
  supplier: string;
  description: string;
};

const categories = [
  { value: "uniform", label: "Uniform" },
  { value: "equipment", label: "Equipment" },
  { value: "accessory", label: "Accessory" },
  { value: "apparel", label: "Apparel" },
  { value: "other", label: "Other" },
];

const initialFormValues: InventoryFormValues = {
  item_name: "",
  category: "equipment",
  quantity: "1",
  price: "0",
  supplier: "",
  description: "",
};

export function InventoryManagement() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formValues, setFormValues] = useState<InventoryFormValues>(initialFormValues);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadInventory = () => {
    fetchInventory()
      .then((data) => {
        if (Array.isArray(data)) {
          setInventoryItems(
            data.map((item) => ({
              item_id: item.item_id,
              item_name: item.item_name,
              category: item.category || item.supplier || "Equipment",
              quantity: Number(item.quantity) || 0,
              price: Number(item.price) || 0,
              supplier: item.supplier,
              description: item.description,
              image_url: item.image_url,
              borrowed: item.borrowed,
            })),
          );
        }
      })
      .catch(() => setInventoryItems([]));
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const openAddDialog = () => {
    setEditingItem(null);
    setFormValues(initialFormValues);
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setErrorMessage(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: InventoryItem) => {
    setEditingItem(item);
    setFormValues({
      item_name: item.item_name,
      category: item.category,
      quantity: String(item.quantity),
      price: String(item.price),
      supplier: item.supplier || "",
      description: item.description || "",
    });
    setSelectedImageFile(null);
    setImagePreviewUrl(item.image_url || null);
    setErrorMessage(null);
    setIsDialogOpen(true);
  };

  const handleImageFileChange = (file: File | null) => {
    if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    if (!file) {
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedImageFile(file);
    setImagePreviewUrl(previewUrl);
  };

  const clearImageSelection = () => {
    if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setErrorMessage(null);
  };

  const handleFormChange = (field: keyof InventoryFormValues, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const saveInventory = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    const basePayload = {
      item_name: formValues.item_name.trim(),
      category: formValues.category,
      quantity: Number(formValues.quantity),
      price: Number(formValues.price),
      supplier: formValues.supplier.trim() || undefined,
      description: formValues.description.trim() || undefined,
    };

    if (!basePayload.item_name || basePayload.quantity < 0 || basePayload.price < 0) {
      setErrorMessage("Please enter a valid item name, quantity, and price.");
      setIsSaving(false);
      return;
    }

    try {
      const hasFile = selectedImageFile !== null;
      const payload = new FormData();
      payload.append("item_name", basePayload.item_name);
      payload.append("category", basePayload.category);
      payload.append("quantity", String(basePayload.quantity));
      payload.append("price", String(basePayload.price));
      if (basePayload.supplier) payload.append("supplier", basePayload.supplier);
      if (basePayload.description) payload.append("description", basePayload.description);

      if (hasFile && selectedImageFile) {
        payload.append("image_file", selectedImageFile);
      } else if (imagePreviewUrl) {
        payload.append("image_url", imagePreviewUrl);
      }

      if (editingItem) {
        await updateInventoryItem(editingItem.item_id, payload);
      } else {
        await createInventoryItem(payload);
      }
      closeDialog();
      loadInventory();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item_id: number) => {
    if (!window.confirm("Delete this inventory item? This cannot be undone.")) {
      return;
    }

    try {
      await deleteInventoryItem(item_id);
      loadInventory();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredItems = inventoryItems.filter((item) =>
    item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalItems = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
  const inStockCount = inventoryItems.filter((item) => item.quantity > 0).length;
  const outOfStockCount = inventoryItems.filter((item) => item.quantity === 0).length;
  const lowStockCount = inventoryItems.filter((item) => item.quantity > 0 && item.quantity < 10).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dojo Inventory</h1>
          <p className="text-sm text-neutral-500">
            {user.role === "admin" || user.role === "instructor"
              ? "Manage equipment and supplies."
              : "Browse available equipment and place an order."}
          </p>
        </div>
        {(user.role === "admin" || user.role === "instructor") ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700" onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
                <DialogDescription>
                  {editingItem
                    ? "Update quantities, pricing, and product details."
                    : "Add a new item to the dojo store inventory."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Item Name</label>
                    <Input
                      value={formValues.item_name}
                      onChange={(event) => handleFormChange("item_name", event.target.value)}
                      placeholder="e.g. Training Gi"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      value={formValues.category}
                      onValueChange={(value) => handleFormChange("category", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Quantity</label>
                    <Input
                      type="number"
                      value={formValues.quantity}
                      min={0}
                      onChange={(event) => handleFormChange("quantity", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Price</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={formValues.price}
                      onChange={(event) => handleFormChange("price", event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Supplier</label>
                  <Input
                    value={formValues.supplier}
                    onChange={(event) => handleFormChange("supplier", event.target.value)}
                    placeholder="Optional vendor or brand"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Item Image</label>
                    <button
                      type="button"
                      className="text-sm text-neutral-500 hover:text-neutral-700"
                      onClick={clearImageSelection}
                    >
                      Clear
                    </button>
                  </div>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => handleImageFileChange(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-neutral-500">
                    Optional image upload for product listing.
                  </p>
                  {imagePreviewUrl ? (
                    <div className="mt-2 h-36 w-full overflow-hidden rounded-lg border border-neutral-200">
                      <img
                        src={imagePreviewUrl}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    rows={3}
                    value={formValues.description}
                    onChange={(event) => handleFormChange("description", event.target.value)}
                    placeholder="Short product description"
                  />
                </div>

                {errorMessage ? (
                  <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={saveInventory}
                    disabled={isSaving}
                  >
                    {editingItem ? "Save Changes" : "Add Item"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{totalItems}</div>
              <div className="text-xs text-neutral-500">Total Items</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{inStockCount}</div>
              <div className="text-xs text-neutral-500">In Stock</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-50">
              <Package className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{lowStockCount}</div>
              <div className="text-xs text-neutral-500">Low Stock</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50">
              <Package className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{outOfStockCount}</div>
              <div className="text-xs text-neutral-500">Out of Stock</div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Item Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredItems.map((item) => (
                <tr key={item.item_id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm font-medium">{item.item_name}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{item.category}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-medium ${
                      item.quantity === 0 ? 'text-red-600' :
                      item.quantity < 10 ? 'text-yellow-600' : 'text-neutral-900'
                    }`}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">
                    ${Number(item.price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    {item.quantity === 0 ? (
                      <Badge variant="outline" className="border-red-300 text-red-700">
                        Out of Stock
                      </Badge>
                    ) : item.quantity < 10 ? (
                      <Badge variant="outline" className="border-yellow-300 text-yellow-700">
                        Low Stock
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-green-300 text-green-700">
                        In Stock
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {(user.role === "admin" || user.role === "instructor") ? (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.item_id)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" className="px-3">
                          Order
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
