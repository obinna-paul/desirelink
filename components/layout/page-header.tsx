export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-[24px] font-bold leading-tight tracking-tight md:text-[28px]">
        {title}
      </h1>
      <p className="mt-1 text-[13.5px] leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
