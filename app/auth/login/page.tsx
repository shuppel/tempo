import AuthForm from '@/app/components/AuthForm';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">Welcome to Toro</h1>
      <AuthForm />
    </div>
  );
} 