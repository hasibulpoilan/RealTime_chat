export default function Avatar({ userId, username, online }) {
    const colors = ['bg-teal-200', 'bg-yellow-200', 'bg-green-200', 'bg-red-200', 'bg-purple-200', 'bg-blue-200'];
    const userIdBase10 = parseInt(userId, 16);

    const colorIndex = userIdBase10 % colors.length;
    const color = colors[colorIndex];

    return (
        <div className={`w-8 h-8 relative rounded-full flex items-center ${color}`}>
            <div className="text-center w-full opacity-70">
                {username ? username[0] : '?'}
            </div>
            {online ? (
                <div className="absolute bg-green-400 w-3 h-3 bottom-0 right-0 rounded-full border-white border"></div>
            ) : (
                <div className="absolute bg-gray-400 w-2 h-2 bottom-0 right-0 rounded-full border-white border"></div> 
            )}
        </div>
    );
}
