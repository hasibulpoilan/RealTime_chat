import Avatar from "./Avatar.jsx";

export default function Contact({ id, username, onClick, selected, online }) {
    return (
        <div
            key={id}
            onClick={() => onClick(id)}
            className={"flex items-center gap-2 cursor-pointer " + (selected ? 'bg-blue-50' : '') + " h-12 w-full"}
        >
            {selected && (
                <div className="w-1 bg-blue-500 h-full rounded-r-md"></div>
            )}
            <div className="flex gap-2 py-2 pl-2 items-center">
                <Avatar online={online} username={username} userId={id} />
                <span className="text-gray-800">{username}</span>
            </div>
        </div>
    );
}

