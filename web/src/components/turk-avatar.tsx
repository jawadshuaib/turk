import Image from "next/image";

export function TurkAvatar({
  avatar,
  name,
  size = "md",
}: {
  avatar: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = { sm: 32, md: 48, lg: 72 };
  const px = dims[size];

  return (
    <div
      className="rounded-full overflow-hidden bg-gray-800 border-2 border-gray-700 flex-shrink-0"
      style={{ width: px, height: px }}
    >
      <Image
        src={`/avatars/${avatar}`}
        alt={name}
        width={px}
        height={px}
        className="object-cover w-full h-full"
      />
    </div>
  );
}
