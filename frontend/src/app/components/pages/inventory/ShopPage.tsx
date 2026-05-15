import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { ClipboardList, Package, ShoppingBag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { ProductShop } from "./ProductShop";
import { InventoryManagement } from "./InventoryManagement";
import { OrderHistory } from "./OrderHistory";
import { OrderManagement } from "./OrderManagement";
import { useAuth } from "../../../auth";

type ShopTab = "products" | "inventory" | "orders";

type TabItem = {
  value: ShopTab;
  label: string;
  icon: typeof ShoppingBag;
};

const getInitialTab = (pathname: string, search: string, isManager: boolean): ShopTab => {
  const params = new URLSearchParams(search);
  const queryTab = params.get("tab");

  if (queryTab === "inventory") {
    return isManager ? "inventory" : "products";
  }
  if (queryTab === "orders") {
    return "orders";
  }
  if (pathname.endsWith("/inventory")) {
    return isManager ? "inventory" : "products";
  }
  if (pathname.endsWith("/orders") || pathname.endsWith("/admin/orders")) {
    return "orders";
  }
  return "products";
};

export function ShopPage() {
  const { user } = useAuth();
  const location = useLocation();
  const isManager = user.role === "admin" || user.role === "instructor";
  const [activeTab, setActiveTab] = useState<ShopTab>(
    getInitialTab(location.pathname, location.search, isManager),
  );

  useEffect(() => {
    setActiveTab(getInitialTab(location.pathname, location.search, isManager));
  }, [location.pathname, location.search, isManager]);

  const tabs = useMemo<TabItem[]>(
    () => [
      { value: "products" as const, label: "Products", icon: ShoppingBag },
      ...(isManager ? [{ value: "inventory" as const, label: "Inventory", icon: Package }] : []),
      { value: "orders" as const, label: isManager ? "Order Management" : "My Orders", icon: ClipboardList },
    ],
    [isManager],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dojo Shop</h1>
          <p className="text-sm text-neutral-500 max-w-2xl">
            Browse equipment, manage inventory, and review orders from one shop workspace.
          </p>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-3xl p-4 shadow-sm">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ShopTab)}>
          <TabsList className="gap-2 p-1">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-6">
            <TabsContent value="products">
              <ProductShop />
            </TabsContent>
            {isManager && (
              <TabsContent value="inventory">
                <InventoryManagement />
              </TabsContent>
            )}
            <TabsContent value="orders">
              {isManager ? <OrderManagement /> : <OrderHistory />}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
