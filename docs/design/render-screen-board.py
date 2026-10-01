"""기존 제비 에셋으로 4화면 디자인 보드를 재현한다. 운영 화면 캡처가 아니다."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
import tempfile
ROOT=Path(__file__).resolve().parents[2]
font_path=Path(tempfile.gettempdir())/'jebi-pretendard-board.ttf'
f=TTFont(ROOT/'public/fonts/PretendardVariable.woff2'); f.flavor=None; f.save(font_path)
W,H=1940,1290
im=Image.new('RGB',(W,H),'#EAE5DA'); d=ImageDraw.Draw(im)
ink='#2C2C2A';muted='#69665B';amber='#9A6410';paper='#FCFBF9';card='#F7F0E2';line='#E1D8C6'
def font(n):return ImageFont.truetype(str(font_path),n)
def text(x,y,s,n=22,color=ink):d.text((x,y),s,font=font(n),fill=color)
def wrap(x,y,s,width=360,n=22,color=ink,gap=1.5):
 for para in s.split('\n'):
  row=''
  for c in para:
   if d.textlength(row+c,font=font(n))>width:
    text(x,y,row,n,color);y+=int(n*gap);row=c
   else:row+=c
  text(x,y,row,n,color);y+=int(n*gap)
 return y
def rect(box,fill=card,r=18,outline=None):d.rounded_rectangle(box,radius=r,fill=fill,outline=outline,width=2)
def art(name,box):
 a=Image.open(ROOT/f'public/img/{name}.webp').convert('RGBA');a.thumbnail((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
 im.paste(a,(box[0]+(box[2]-box[0]-a.width)//2,box[1]+(box[3]-box[1]-a.height)//2),a)
def cta(x,y,label,w=370,secondary=False):
 rect((x,y,x+w,y+62),card if secondary else amber,14,line if secondary else None)
 text(x+(w-d.textlength(label,font=font(22)))//2,y+17,label,22,muted if secondary else 'white')
def phone(i,title):
 x=40+i*475;rect((x,160,x+435,1190),paper,28,line);text(x+20,120,title,22,amber);text(x+24,180,'9:41',17,muted);text(x+345,180,'● ▰',17,muted);return x+32
text(40,28,'제비 · 핵심 화면 디자인',40);text(40,86,'흥부에게 복을 가져온 제비처럼, 기억한 정이 다음 인사로 이어지는 집',24,muted)
x=phone(0,'01  온보딩');text(x,244,'정을 기억하는 제비',19,amber);wrap(x,288,'마음을 챙기면,\n인연이 자라는 집',365,33)
art('house_jebi_intro',(x-10,410,x+380,698));wrap(x,729,'흥부에게 돌아온 박씨처럼,\n기억한 정이 다음 인사로 이어져요.',365,23)
text(x+150,890,'●  ○  ○',22,amber);cta(x,950,'다음');cta(x,1023,'건너뛰기',secondary=True);text(x+62,1120,'예시로 먼저 체험할 수 있어요',18,muted)
x=phone(1,'02  홈');text(x+140,238,'우리 집',27);text(x,308,'오늘 챙길 마음',18,amber);text(x,350,'다가오는 인연의 순간',28)
rect((x,405,x+370,552),card,18,line);text(x+20,423,'10월 4일 · D-3',19,amber);text(x+20,462,'김도현님의 결혼식',26);text(x+20,504,'일정 확인하기  ›',20,muted)
art('house_empty',(x-10,578,x+380,827));art('jebi_perched',(x+275,578,x+360,671));wrap(x+10,833,'기억하고 전한 마음이\n우리 집의 이야기가 돼요.',350,22)
rect((x,922,x+178,1006));rect((x+191,922,x+370,1006));text(x+18,936,'받은 마음',18,muted);text(x+18,966,'0개',24);text(x+211,936,'전한 마음',18,muted);text(x+211,966,'0개',24)
cta(x,1040,'+ 소식 기록하기');text(x+18,1137,'우리 집           인연             나',19,muted)
x=phone(2,'03  기록 입력');text(x+91,240,'일정 기억하기',27);text(x,310,'무엇을 기억할까요?',24)
rect((x,355,x+370,431),card,14,amber);text(x+18,366,'● 일정 기억하기',22,amber);text(x+18,400,'소식을 남기고 챙길 날을 기억해요',18,muted)
rect((x,445,x+370,521),paper,14,line);text(x+18,456,'○ 돈·선물 기록하기',22);text(x+18,490,'실제로 주고받은 마음을 남겨요',18,muted)
y=548
for label,value in [('인연 이름','김도현'),('경조사 종류','결혼'),('날짜','2026년 10월 4일'),('장소 · 메모','그랜드컨벤션')]:
 text(x,y,label,18,muted);rect((x,y+30,x+370,y+84),'white',10,line);text(x+15,y+44,value,22);y+=104
wrap(x,971,'일정 저장은 참석·지출 완료가 아니에요.',365,18,muted);cta(x,1060,'일정 저장하기')
x=phone(3,'04  인연 상세');text(x+88,238,'인연의 기억',27);rect((x,307,x+65,372),card,32);text(x+18,322,'도',30,amber);text(x+87,308,'김도현',30);text(x+87,350,'회사 · 기억 2개',19,muted);cta(x,406,'+ 마음 기록하기',w=218,secondary=True);cta(x+230,406,'인연 수정',w=140,secondary=True)
rect((x,497,x+183,555),amber,14);text(x+29,514,'인연의 기억',21,'white');rect((x+192,497,x+370,555),paper,14,line);text(x+207,514,'돈·선물 기록',21)
wrap(x,579,'소식과 주고받은 마음을 날짜순으로 돌아봐요.',365,20,muted)
for y,tag,head,body in [(672,'일정','10월 4일 · 결혼','소식을 기억해요\n오후 1시 · 그랜드컨벤션'),(886,'전한 선물','2025년 11월 3일 · 생일','커피 선물을 전했어요\n전한 마음 · 10,000원')]:
 rect((x,y,x+370,y+187),card,16,line);text(x+18,y+18,tag,18,amber);text(x+18,y+55,head,23);wrap(x+18,y+98,body,330,21,muted)
text(40,1220,'디자인 시안 · 예시 데이터 · 실제 프리뷰 캡처가 아닙니다. 기존 제비·초가집 에셋을 그대로 사용했습니다.',20,muted)
im.save(ROOT/'docs/design/JEBI-Screen-Overview.png')
