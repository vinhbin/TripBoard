import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function AvailabilityTab({ trip }) {
  const { user } = useAuth();
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchAvailabilities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip._id]);

  const fetchAvailabilities = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/trips/${trip._id}/availability`);
      setAvailabilities(data.availabilities);
    } catch (err) {
      console.error('Failed to fetch availabilities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (date, newStatus) => {
    setUpdating(true);
    try {
      const isoDate = date.toISOString().split('T')[0];

      if (newStatus === null) {
        await api.delete(`/trips/${trip._id}/availability`, { data: { date: isoDate } });
        setAvailabilities((prev) =>
          prev.filter(
            (a) =>
              !(
                new Date(a.date).toDateString() === date.toDateString() &&
                a.userId._id === user.id
              ),
          ),
        );
        return;
      }

      const { data } = await api.post(`/trips/${trip._id}/availability`, {
        date: isoDate,
        status: newStatus,
      });

      setAvailabilities((prev) => {
        const filtered = prev.filter(
          (a) =>
            !(
              new Date(a.date).toDateString() === date.toDateString() &&
              a.userId._id === user.id
            ),
        );
        return [...filtered, data.availability];
      });
    } catch (err) {
      console.error('Failed to update availability:', err);
      alert('Failed to update availability');
    } finally {
      setUpdating(false);
    }
  };

  const getDatesInRange = () => {
    const dates = [];
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  const getUserStatus = (date) => {
    const availability = availabilities.find(
      (a) =>
        new Date(a.date).toDateString() === date.toDateString() && a.userId._id === user.id,
    );
    return availability?.status || null;
  };

  const getDateScore = (date) => {
    const dateAvails = availabilities.filter(
      (a) => new Date(a.date).toDateString() === date.toDateString(),
    );
    let score = 0;
    dateAvails.forEach((a) => {
      if (a.status === 'can') score += 3;
      else if (a.status === 'maybe') score += 1;
      else if (a.status === 'cannot') score -= 2;
    });
    return score;
  };

  const getDateStatuses = (date) =>
    trip.members.map((member) => {
      const availability = availabilities.find(
        (a) =>
          new Date(a.date).toDateString() === date.toDateString() &&
          a.userId._id === member._id,
      );
      return {
        member,
        status: availability?.status || null,
      };
    });

  const cycleStatus = (currentStatus) => {
    const cycle = [null, 'can', 'maybe', 'cannot'];
    const currentIndex = cycle.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % cycle.length;
    return cycle[nextIndex];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'can':
        return 'bg-green-500 text-white';
      case 'maybe':
        return 'bg-yellow-500 text-white';
      case 'cannot':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-200 text-gray-600';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'can':
        return '✓ Can Go';
      case 'maybe':
        return '? Maybe';
      case 'cannot':
        return '✗ Cannot';
      default:
        return 'No Response';
    }
  };

  const formatDateHeader = (date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const dates = getDatesInRange();

  const rankedDates = dates
    .map((date) => ({
      date,
      score: getDateScore(date),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (loading) {
    return <div className="text-center py-8">Loading availability...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How to vote:</h3>
        <p className="text-sm text-blue-800">
          Click on any date to cycle through:{' '}
          <span className="font-medium">No Response → Can Go → Maybe → Cannot → No Response</span>
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Dates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rankedDates.map(({ date, score }, index) => (
            <div key={date.toISOString()} className="border rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500 mb-1">#{index + 1}</div>
              <div className="text-lg font-semibold text-gray-900 mb-2">
                {formatDateHeader(date)}
              </div>
              <div className="text-2xl font-bold text-blue-600">Score: {score}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Date Availability</h3>
        <div className="space-y-4">
          {dates.map((date) => {
            const userStatus = getUserStatus(date);
            const score = getDateScore(date);
            const memberStatuses = getDateStatuses(date);

            return (
              <div key={date.toISOString()} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{formatDateHeader(date)}</h4>
                    <div className="text-sm text-gray-600">
                      Group Score: <span className="font-semibold text-blue-600">{score}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStatusChange(date, cycleStatus(userStatus))}
                    disabled={updating}
                    className={`px-4 py-2 rounded-lg font-medium transition ${getStatusColor(
                      userStatus,
                    )} ${updating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                  >
                    {getStatusLabel(userStatus)}
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {memberStatuses.map(({ member, status }) => (
                    <div key={member._id} className="flex items-center gap-2 text-sm">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          status === 'can'
                            ? 'bg-green-500'
                            : status === 'maybe'
                            ? 'bg-yellow-500'
                            : status === 'cannot'
                            ? 'bg-red-500'
                            : 'bg-gray-300'
                        }`}
                      />
                      <span className={member._id === user.id ? 'font-semibold' : ''}>
                        {member.name} {member._id === user.id && '(You)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span className="text-sm">Can Go (+3 points)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500" />
            <span className="text-sm">Maybe (+1 point)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span className="text-sm">Cannot (-2 points)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-300" />
            <span className="text-sm">No Response</span>
          </div>
        </div>
      </div>
    </div>
  );
}
