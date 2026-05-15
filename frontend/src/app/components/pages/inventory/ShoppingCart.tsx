import { useEffect, useState } from "react";
import { ShoppingCart as ShoppingCartIcon, Trash2, Plus, Minus, ChevronLeft } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { useAuth } from "../../../auth";
import { getCart, updateCartItem, removeFromCart, clearCart } from "../../../api";
import { useNavigate } from "react-router";

type CartItem = {
  id: number;
  inventory_item: {
    item_id: number;
    item_name: string;
    price: string;
    image_url?: string;
  };
  quantity: number;
  subtotal: number;
};

type Cart = {
  id: number;
  items: CartItem[];
  total_price: number;
  item_count: number;
};

export function ShoppingCart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    loadCart();
  }, [user, navigate]);

  const loadCart = async () => {
    try {
      setLoading(true);
      const data = await getCart();
      setCart(data);
    } catch (error) {
      console.error('Error loading cart:', error);
      setCart(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (cartItemId: number, newQuantity: number) => {
    if (newQuantity < 0) return;

    setUpdating(cartItemId);
    try {
      await updateCartItem(cartItemId, newQuantity);
      await loadCart();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (cartItemId: number) => {
    if (!confirm('Remove item from cart?')) return;

    setUpdating(cartItemId);
    try {
      await removeFromCart(cartItemId);
      await loadCart();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleClearCart = async () => {
    if (!confirm('Clear entire cart?')) return;

    try {
      await clearCart();
      await loadCart();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleCheckout = () => {
    if (!cart || cart.items.length === 0) {
      alert('Cart is empty');
      return;
    }
    navigate('/dashboard/checkout');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="p-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Shopping Cart</h1>
            <p className="text-sm text-neutral-600 mt-1">
              {loading ? "Loading..." : `${cart?.item_count || 0} item(s) in cart`}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-neutral-500">Loading cart...</p>
        </div>
      ) : !cart || cart.items.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-neutral-200 rounded-lg">
          <ShoppingCartIcon className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
          <p className="text-neutral-500 mb-4">Your cart is empty</p>
          <Button
            onClick={() => navigate('/dashboard/shop')}
            className="bg-red-600 hover:bg-red-700"
          >
            Continue Shopping
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-neutral-200 rounded-lg p-4 flex gap-4"
              >
                {/* Product Image */}
                <div className="w-20 h-20 bg-neutral-100 rounded flex items-center justify-center flex-shrink-0">
                  {item.inventory_item.image_url ? (
                    <img
                      src={item.inventory_item.image_url}
                      alt={item.inventory_item.item_name}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <ShoppingCartIcon className="h-8 w-8 text-neutral-300" />
                  )}
                </div>

                {/* Product Details */}
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold">{item.inventory_item.item_name}</h3>
                  <p className="text-sm text-neutral-600">
                    ₱{parseFloat(item.inventory_item.price).toFixed(2)} each
                  </p>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                      disabled={updating === item.id || item.quantity <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleUpdateQuantity(item.id, Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 text-center"
                      disabled={updating === item.id}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                      disabled={updating === item.id}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Subtotal and Remove */}
                <div className="text-right space-y-2 flex flex-col items-end justify-between">
                  <div>
                    <p className="text-sm text-neutral-600">Subtotal</p>
                    <p className="text-lg font-bold text-red-600">
                      ₱{item.subtotal.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRemove(item.id)}
                    disabled={updating === item.id}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 space-y-4 sticky top-4">
              <h2 className="font-bold text-lg">Order Summary</h2>

              <div className="space-y-2 py-4 border-y">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>₱{cart.total_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span>Meetup at Dojo</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Payment</span>
                  <span>Cash on Pickup</span>
                </div>
              </div>

              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-red-600">₱{cart.total_price.toFixed(2)}</span>
              </div>

              <div className="space-y-2 pt-4">
                <Button
                  onClick={handleCheckout}
                  className="w-full bg-red-600 hover:bg-red-700 h-12 text-base"
                >
                  Proceed to Checkout
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard/shop')}
                  className="w-full"
                >
                  Continue Shopping
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleClearCart}
                  className="w-full text-red-600 hover:text-red-700"
                >
                  Clear Cart
                </Button>
              </div>

              <div className="text-xs text-neutral-500 bg-blue-50 p-3 rounded">
                <p className="font-semibold mb-1">📍 Pickup Information</p>
                <p>All items will be available for pickup at the dojo. Pay when you pick up your order.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
