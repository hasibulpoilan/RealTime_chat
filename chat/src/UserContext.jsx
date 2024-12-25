import { createContext, useState, useEffect } from "react";

export const UserContext = createContext({});

export const UserContextProvider = ({ children }) => {
  const [username, setUsername] = useState(null);
  const [id, setId] = useState(null);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const response = await fetch('http://localhost:4000/profile', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            setUsername(data.username);
            setId(data.id);
          } else {
            console.error('Unauthorized:', response.status);
          }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    checkLoggedIn();
  }, []);

  return (
    <UserContext.Provider value={{ username, setUsername, id, setId }}>
      {children}
    </UserContext.Provider>
  );
};
