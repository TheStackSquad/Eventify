//frontend/src/components/create-events/components/stepIndicator.js

export default function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center flex-1">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
              currentStep >= step
                ? "bg-green-600 border-green-600 text-white"
                : "bg-gray-800 border-gray-600 text-gray-400"
            }`}
          >
            {step}
          </div>
          {step < 4 && (
            <div
              className={`flex-1 h-1 mx-2 transition-all ${
                currentStep > step ? "bg-green-600" : "bg-gray-700"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}