import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

// Simple colored pin via SVG path
const pinPath =
  'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z';

const categoryColor = {
  restaurant: '#ef4444',
  attraction: '#3b82f6',
  hotel: '#8b5cf6',
  activity: '#10b981',
  other: '#6b7280',
};

const getMarkerIcon = (category) => {
  const fill = categoryColor[category] || categoryColor.other;
  return {
    path: pinPath,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 1,
    scale: 1.5,
    anchor: { x: 12, y: 24 },
  };
};

export default function MapTab({ trip }) {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPin, setEditingPin] = useState(null);
  const [newPinLocation, setNewPinLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [placeDetails, setPlaceDetails] = useState(null);
  const [autoAddPin, setAutoAddPin] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: 'other',
    notes: '',
  });

  const center = useMemo(() => ({ lat: 48.8566, lng: 2.3522 }), []);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

  useEffect(() => {
    fetchPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip._id]);

  useEffect(() => {
    if (mapRef.current && trip.destination) {
      geocodeDestination(trip.destination);
    }
  }, [trip.destination, isLoaded]);

  const geocodeDestination = async (query) => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&accept-language=en&q=${encodeURIComponent(
          query,
        )}`,
      );
      const data = await resp.json();
      if (data && data.length > 0 && mapRef.current) {
        mapRef.current.panTo({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      }
    } catch (err) {
      console.error('Geocoding failed:', err);
    }
  };

  const fetchPins = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/trips/${trip._id}/pins`);
      setPins(data.pins);
    } catch (err) {
      console.error('Failed to fetch pins:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setNewPinLocation({ lat, lng });
    setShowAddForm(true);
    setFormData({ title: '', category: 'other', notes: '' });
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreatePin = async (e) => {
    e.preventDefault();
    if (!newPinLocation) return;
    try {
      const { data } = await api.post(`/trips/${trip._id}/pins`, {
        lat: newPinLocation.lat,
        lng: newPinLocation.lng,
        ...formData,
      });
      setPins((prev) => [data.pin, ...prev]);
      setShowAddForm(false);
      setNewPinLocation(null);
      setFormData({ title: '', category: 'other', notes: '' });
    } catch (err) {
      alert('Failed to create pin: ' + (err.response?.data?.error || 'Unknown error'));
    }
  };

  const handleUpdatePin = async (e) => {
    e.preventDefault();
    if (!editingPin) return;
    try {
      const { data } = await api.put(`/pins/${editingPin._id}`, formData);
      setPins((prev) => prev.map((p) => (p._id === editingPin._id ? data.pin : p)));
      setEditingPin(null);
      setFormData({ title: '', category: 'other', notes: '' });
    } catch (err) {
      alert('Failed to update pin: ' + (err.response?.data?.error || 'Unknown error'));
    }
  };

  const handleDeletePin = async (pinId) => {
    if (!window.confirm('Are you sure you want to delete this pin?')) return;
    try {
      await api.delete(`/pins/${pinId}`);
      setPins((prev) => prev.filter((p) => p._id !== pinId));
    } catch (err) {
      alert('Failed to delete pin: ' + (err.response?.data?.error || 'Unknown error'));
    }
  };

  const startEditingPin = (pin) => {
    setEditingPin(pin);
    setFormData({
      title: pin.title,
      category: pin.category,
      notes: pin.notes || '',
    });
    setShowAddForm(false);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingPin(null);
    setNewPinLocation(null);
    setFormData({ title: '', category: 'other', notes: '' });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!mapRef.current) return;
    if (searchQuery.trim().length < 3) {
      setSearchError('Enter at least 3 characters');
      return;
    }
    setSearchError('');
    setSearchLoading(true);
    const service = new window.google.maps.places.PlacesService(mapRef.current);
    service.textSearch({ query: searchQuery, language: 'en' }, (results, status) => {
      setSearchLoading(false);
      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
        setSearchError('No results');
        setSearchResults([]);
        return;
      }
      setSearchResults(results.slice(0, 6));
    });
  };

  const handleSelectResult = (result) => {
    if (!result.geometry?.location) return;
    const lat = result.geometry.location.lat();
    const lng = result.geometry.location.lng();
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(13);
    }
    setNewPinLocation({ lat, lng });
    setShowAddForm(true);
    setFormData((prev) => ({ ...prev, title: result.name || prev.title }));
    setSearchResults([]);
    fetchPlaceDetails(result.place_id);

    // Offer to auto-add as a pin
    if (window.confirm('Add this place as a pin?')) {
      const autoNotesParts = [];
      if (result.formatted_address) autoNotesParts.push(`Address: ${result.formatted_address}`);
      if (result.rating) autoNotesParts.push(`Rating: ${result.rating} ⭐`);
      if (result.place_id) autoNotesParts.push(`Google Place ID: ${result.place_id}`);
      const autoNotes = autoNotesParts.join('\n');
      api
        .post(`/trips/${trip._id}/pins`, {
          lat,
          lng,
          title: result.name || 'Pinned place',
          category: 'other',
          notes: autoNotes,
        })
        .then(({ data }) => setPins((prev) => [data.pin, ...prev]))
        .catch((err) => {
          alert('Failed to add pin: ' + (err.response?.data?.error || 'Unknown error'));
        });
    }
  };

  const fetchPlaceDetails = (placeId) => {
    if (!mapRef.current || !placeId) return;
    const service = new window.google.maps.places.PlacesService(mapRef.current);
    service.getDetails(
      {
        placeId,
        fields: ['name', 'formatted_address', 'formatted_phone_number', 'website', 'rating', 'url'],
      },
      (details, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && details) {
          setPlaceDetails(details);
          // Prefill notes/title when adding a new pin (avoid clobbering edit form)
          if (!editingPin) {
            const parts = [];
            if (details.formatted_address) parts.push(`Address: ${details.formatted_address}`);
            if (details.formatted_phone_number) parts.push(`Phone: ${details.formatted_phone_number}`);
            if (details.rating) parts.push(`Rating: ${details.rating} ⭐`);
            if (details.website) parts.push(`Website: ${details.website}`);
            if (details.url) parts.push(`Google Maps: ${details.url}`);
            const autoNotes = parts.join('\n');
            setFormData((prev) => ({
              ...prev,
              title: prev.title || details.name || prev.title,
              notes: autoNotes || prev.notes,
            }));
          }
        } else {
          setPlaceDetails(null);
        }
      },
    );
  };

  const getCategoryLabel = (category) => {
    const labels = {
      restaurant: '🍽️ Restaurant',
      attraction: '🎭 Attraction',
      hotel: '🏨 Hotel',
      activity: '⚡ Activity',
      other: '📍 Other',
    };
    return labels[category] || labels.other;
  };

  if (!isLoaded) {
    return <div className="text-center py-8">Loading map...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Click anywhere on the map</strong> to add a new pin for places you want to visit!
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: '600px' }}>
          <GoogleMap
            center={center}
            zoom={12}
            mapContainerStyle={{ width: '100%', height: '100%' }}
            onLoad={(map) => (mapRef.current = map)}
            onClick={handleMapClick}
            options={{ streetViewControl: false, fullscreenControl: true, mapTypeControl: false }}
          >
            {pins.map((pin) => (
              <Marker
                key={pin._id}
                position={{ lat: pin.lat, lng: pin.lng }}
                icon={getMarkerIcon(pin.category)}
                label={{
                  text: pin.title,
                  className: 'map-pin-label',
                  color: '#0f172a',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              />
            ))}

            {newPinLocation && (
              <Marker
                position={{ lat: newPinLocation.lat, lng: newPinLocation.lng }}
                icon={getMarkerIcon('other')}
                label={{
                  text: 'New pin',
                  className: 'map-pin-label',
                  color: '#0f172a',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              />
            )}
          </GoogleMap>
        </div>
      </div>

      <div className="space-y-4">
        {(showAddForm || editingPin) && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-semibold text-gray-900 mb-4">{editingPin ? 'Edit Pin' : 'Add New Pin'}</h3>
            <form onSubmit={editingPin ? handleUpdatePin : handleCreatePin} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  placeholder="Eiffel Tower"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="restaurant">🍽️ Restaurant</option>
                  <option value="attraction">🎭 Attraction</option>
                  <option value="hotel">🏨 Hotel</option>
                  <option value="activity">⚡ Activity</option>
                  <option value="other">📍 Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Any additional details..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="flex-1 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingPin ? 'Update' : 'Add Pin'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Search places</h3>
          <form onSubmit={handleSearch} className="flex gap-2 mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search places (e.g., Louvre)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              type="submit"
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              disabled={searchLoading}
            >
              {searchLoading ? '...' : 'Search'}
            </button>
          </form>
          {searchError && <div className="text-xs text-red-600 mb-2">{searchError}</div>}
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {searchResults.map((r) => (
                <button
                  key={`${r.place_id}`}
                  onClick={() => handleSelectResult(r)}
                  className="w-full text-left border border-gray-200 rounded-lg p-2 hover:bg-gray-50"
                >
                  <div className="text-sm font-semibold text-gray-900">{r.name || r.formatted_address}</div>
                  <div className="text-xs text-gray-600">{r.formatted_address || r.name}</div>
                </button>
              ))}
            </div>
          )}
          {placeDetails && (
            <div className="mt-3 border border-gray-200 rounded-lg p-3">
              <h4 className="font-semibold text-gray-900 text-sm mb-1">{placeDetails.name}</h4>
              {placeDetails.rating && (
                <div className="text-xs text-gray-700 mb-1">Rating: {placeDetails.rating} ⭐</div>
              )}
              {placeDetails.formatted_address && (
                <div className="text-xs text-gray-600 mb-1">{placeDetails.formatted_address}</div>
              )}
              {placeDetails.formatted_phone_number && (
                <div className="text-xs text-gray-700 mb-1">Phone: {placeDetails.formatted_phone_number}</div>
              )}
              {placeDetails.website && (
                <a
                  className="text-xs text-blue-600 hover:underline block"
                  href={placeDetails.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  Website
                </a>
              )}
              {placeDetails.url && (
                <a
                  className="text-xs text-blue-600 hover:underline block"
                  href={placeDetails.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps
                </a>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Places ({pins.length})</h3>

          {pins.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No pins yet. Click on the map or search to add places!
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {pins.map((pin) => (
                <div key={pin._id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm">{pin.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">{getCategoryLabel(pin.category)}</p>
                      {pin.notes && <p className="text-xs text-gray-700 mt-1">{pin.notes}</p>}
                      <p className="text-xs text-gray-400 mt-1">By {pin.userId.name}</p>
                    </div>
                    {pin.userId._id === user.id && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditingPin(pin)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeletePin(pin._id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Pin Categories</h3>
          <div className="space-y-2">
            {['restaurant', 'attraction', 'hotel', 'activity', 'other'].map((cat) => (
              <div key={cat} className="flex items-center gap-2 text-sm">
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: categoryColor[cat],
                  }}
                />
                <span className="text-gray-700">{getCategoryLabel(cat)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
