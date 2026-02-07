from geopy.geocoders import Nominatim

def get_building_name_free(lat, lon):
    # You MUST provide a unique user_agent name
    geolocator = Nominatim(user_agent="my_building_finder_v1")
    
    try:
        # Get the location
        location = geolocator.reverse(f"{lat}, {lon}")
        
        # Extract details
        address_info = location.raw.get('address', {})
        
        # Try to find the specific building name in the data
        # OpenStreetMap stores names in various fields like 'building', 'tourism', 'amenity', etc.
        building_name = (
            address_info.get('tourism') or 
            address_info.get('building') or 
            address_info.get('amenity') or 
            address_info.get('leisure') or
            address_info.get('office')
        )
        
        if building_name:
            return building_name
        else:
            return address_info
        
    except Exception as e:
        return str(e)

# Example: Eiffel Tower
print(get_building_name_free(43.2230318, -79.8564301))