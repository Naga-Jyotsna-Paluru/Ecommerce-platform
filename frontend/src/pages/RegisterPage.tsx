import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/auth';
import useAuthStore from '../store/authStore';
import { SpinnerIcon } from '../components/common';

export default function RegisterPage() {
  const navigate   = useNavigate();
  const setAuth    = useAuthStore((s) => s.setAuth);

  const [form, setForm]       = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const res = await authApi.register(form);
      const { user, accessToken } = res.data.data;
      setAuth(user, accessToken);
      navigate('/products');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string; errors?: { field: string; message: string }[] } } })?.response?.data;
      if (response?.errors) {
        const fieldErrors: Record<string, string> = {};
        response.errors.forEach(({ field, message }) => { fieldErrors[field] = message; });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: response?.message ?? 'Registration failed. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { id: 'firstName', label: 'First name', type: 'text',  placeholder: 'Jane' },
    { id: 'lastName',  label: 'Last name',  type: 'text',  placeholder: 'Doe' },
    { id: 'email',     label: 'Email',      type: 'email', placeholder: 'jane@example.com' },
    { id: 'password',  label: 'Password',   type: 'password', placeholder: '••••••••' },
  ] as const;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create an account</h1>
        <p className="text-sm text-gray-500 mb-6">Start shopping today</p>

        {errors.general && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(({ id, label, type, placeholder }) => (
            <div key={id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type}
                required
                value={form[id]}
                onChange={update(id)}
                placeholder={placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors[id] && <p className="text-xs text-red-500 mt-1">{errors[id]}</p>}
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {loading && <SpinnerIcon className="w-4 h-4" />}
            Create account
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
