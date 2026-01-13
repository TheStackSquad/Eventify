// frontend/src/app/events/[id]/components/ActionButtons.js
import { ShoppingCart, CheckCircle } from "lucide-react";

const ActionButtons = ({
  handleAddToCart,
  handleCheckoutNow,
  isSoldOut,
  isAdded,
}) => (
  <div className="flex flex-col gap-3 mt-6">
    <button
      onClick={handleAddToCart}
      disabled={isSoldOut || isAdded}
      className={`w-full flex items-center justify-center py-3 px-4 font-semibold rounded-lg transition-all duration-300 transform active:scale-95 ${
        isSoldOut
          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
          : isAdded
          ? "bg-green-500 text-white"
          : "bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md hover:shadow-lg"
      }`}
      aria-label={
        isSoldOut
          ? "Tickets sold out"
          : isAdded
          ? "Added to cart"
          : "Add to cart"
      }
    >
      {isAdded ? (
        <>
          <CheckCircle size={20} className="mr-2" aria-hidden="true" />
          Added!
        </>
      ) : (
        <>
          <ShoppingCart size={20} className="mr-2" aria-hidden="true" />
          Add to Cart
        </>
      )}
    </button>

    <button
      onClick={handleCheckoutNow}
      disabled={isSoldOut}
      className={`w-full flex items-center justify-center py-3 px-4 font-semibold rounded-lg transition-all duration-300 transform active:scale-95 ${
        isSoldOut
          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
          : "bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md hover:shadow-lg"
      }`}
      aria-label={
        isSoldOut ? "Tickets sold out" : "Buy now and proceed to checkout"
      }
    >
      Buy Now & Checkout
    </button>
  </div>
);

export default ActionButtons;
