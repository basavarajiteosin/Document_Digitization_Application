import React, { createContext, useState, useContext } from 'react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [isChangePasswordRequired, setIsChangePasswordRequired] = useState("No");

  return (
    <UserContext.Provider value={{ isChangePasswordRequired, setIsChangePasswordRequired }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => useContext(UserContext);
