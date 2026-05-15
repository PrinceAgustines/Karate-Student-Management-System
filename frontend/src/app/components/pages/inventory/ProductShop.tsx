import { useEffect, useState } from "react";
import { ShoppingBag, Search, Filter, Star } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { useAuth } from "../../../auth";
import { fetchProducts, addToCart } from "../../../api";
import { useNavigate } from "react-router";

const formatPeso = (value: number | string) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value));

type Product = {
  item_id: number;
  item_name: string;
  description: string;
  category: string;
  price: number;
  quantity: number;
  image_url?: string;
  is_available: boolean;
};

const CATEGORIES = [
  { value: 'all', label: 'All Products' },
  { value: 'uniform', label: 'Uniform' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'other', label: 'Other' },
];

export function ProductShop() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [addingToCart, setAddingToCart] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    loadProducts();
  }, [selectedCategory, searchQuery]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const data = await fetchProducts(params);
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const inStockProducts = products.filter((product) => product.quantity > 0);
  const filteredProducts = inStockProducts.filter((product) =>
    product.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddToCart = async (product: Product) => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    const quantity = quantities[product.item_id] || 1;
    setAddingToCart(product.item_id);

    try {
      await addToCart(product.item_id, quantity);
      alert(`Added ${quantity}x ${product.item_name} to cart!`);
      setQuantities({ ...quantities, [product.item_id]: 1 });
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setAddingToCart(null);
    }
  };

  const handleQuantityChange = (productId: number, value: string) => {
    const qty = Math.max(1, parseInt(value) || 1);
    setQuantities({ ...quantities, [productId]: qty });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dojo Shop</h1>
          <p className="text-sm text-neutral-600 mt-1">Browse and purchase gear, equipment, and apparel</p>
        </div>
        <Button
          onClick={() => navigate('/dashboard/cart')}
          className="bg-red-600 hover:bg-red-700"
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          View Cart
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat.value)}
              className={selectedCategory === cat.value ? "bg-red-600 hover:bg-red-700" : ""}
            >
              <Filter className="h-3 w-3 mr-1" />
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-neutral-500">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingBag className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
          <p className="text-neutral-500">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.item_id}
              className="bg-white border border-neutral-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Product Image */}
              <div className="h-48 bg-neutral-100 flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.item_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ShoppingBag className="h-12 w-12 text-neutral-300" />
                )}
              </div>

              {/* Product Info */}
              <div className="p-4 space-y-3">
                {/* Badge */}
                <div className="flex gap-2">
                  <Badge variant="secondary">{product.category}</Badge>
                  {product.quantity === 0 ? (
                    <Badge variant="destructive">Out of Stock</Badge>
                  ) : (
                    <Badge variant="secondary">In Stock</Badge>
                  )}
                </div>

                {/* Name */}
                <h3 className="font-semibold line-clamp-2">{product.item_name}</h3>

                {/* Description */}
                <p className="text-sm text-neutral-600 line-clamp-2">
                  {product.description || "No description available"}
                </p>

                {/* Stock Info */}
                <p className="text-xs text-neutral-500">
                  {product.quantity} in stock
                </p>

                {/* Price */}
                <div className="text-2xl font-bold text-red-600">
                  {formatPeso(product.price)}
                </div>

                {/* Add to Cart */}
                {product.quantity > 0 ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        max={product.quantity}
                        value={quantities[product.item_id] || 1}
                        onChange={(e) => handleQuantityChange(product.item_id, e.target.value)}
                        className="w-20"
                      />
                      <Button
                        onClick={() => handleAddToCart(product)}
                        disabled={addingToCart === product.item_id}
                        className="flex-1 bg-red-600 hover:bg-red-700"
                      >
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        {addingToCart === product.item_id ? "Adding..." : "Add to Cart"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button disabled className="w-full opacity-50">
                    Out of Stock
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
