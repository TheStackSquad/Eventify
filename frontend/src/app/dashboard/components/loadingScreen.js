// frontend/src/app/dashboard/components/loadingScreen.js

export default function LoadingScreen({ message = "Loading..." }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="relative w-16 h-16 mx-auto mb-6" aria-label="Loading">
          <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{message}</h2>
        <p className="text-sm text-gray-500">Please wait a moment</p>
      </div>
    </div>
  );
}
