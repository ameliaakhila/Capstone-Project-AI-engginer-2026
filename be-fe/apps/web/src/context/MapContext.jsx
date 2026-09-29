import { createContext, useContext, useState } from "react";

const MapContext = createContext();

export const MapProvider = ({ children }) => {
    const [selectedLocation, setSelectedLocation] = useState(null);

    return (
        <MapContext.Provider value={{ selectedLocation, setSelectedLocation }}>
            {children}
        </MapContext.Provider>
    );
};

export const useMap = () => useContext(MapContext);