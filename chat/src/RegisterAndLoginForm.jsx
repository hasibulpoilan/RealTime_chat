import { useContext, useState } from "react";
import { UserContext } from "./UserContext";

export default function RegisterAndLoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingOrRegistering, setIsLoggingOrRegistering] = useState('login');
  const { username: loggedInUsername, setUsername: setLoggedInUsername, setId } = useContext(UserContext);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const url = isLoggingOrRegistering === 'register' 
      ? 'http://localhost:4000/register' 
      : 'http://localhost:4000/login';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setId(data.user.id); 
        setLoggedInUsername(data.user.username); 
      } else {
        console.log(`Failed to ${isLoggingOrRegistering}:`, response.status);
      }
    } catch (error) {
      console.error(`Error during ${isLoggingOrRegistering}:`, error);
    }
  };

  if (loggedInUsername) {
    return (
      <div className="bg-blue-50 h-screen flex items-center justify-center">
        <h1 className="text-xl">Welcome, {loggedInUsername}!</h1>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 h-screen flex items-center">
      <form className="w-64 mx-auto mb-12" onSubmit={handleSubmit}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          className="block w-full rounded-sm p-2 mb-2 border"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="block w-full rounded-sm p-2 mb-2 border"
        />
        <button className="bg-blue-500 text-white block w-full rounded-sm p-2">
          {isLoggingOrRegistering === 'register' ? 'Register' : 'Login'}
        </button>
        <div className="text-center mt-2">
          {isLoggingOrRegistering === 'register' ? (
            <div>
              Already a member?
              <button
                type="button"
                className="ml-1 underline"
                onClick={() => setIsLoggingOrRegistering('login')}
              >
                Login here
              </button>
            </div>
          ) : (
            <div>
              Don't have an account?
              <button
                type="button"
                className="ml-1 underline"
                onClick={() => setIsLoggingOrRegistering('register')}
              >
                Register
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
